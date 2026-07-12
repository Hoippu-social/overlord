import http from 'http';
import { Client } from 'discord.js';
import logger from './logger';
import { prisma, statsPrisma } from './database';
import { reviewAppealTicket } from '../services/AppealService';
import { syncAppealPanels } from '../services/AppealInteractionService';
import { sendTicketPanelPreview, syncAllTicketPanels, syncTicketPanel } from '../services/TicketPanelService';
import { parseAuditRouteChannelIds, serializeAuditRouteChannelIds } from './auditRouteChannels';

const PORT = Number.parseInt(process.env.DASHBOARD_API_PORT || '3002', 10);
const API_KEY = process.env.DASHBOARD_API_KEY || '';
const REQUIRE_API_KEY = process.env.NODE_ENV === 'production' || process.env.DASHBOARD_API_REQUIRE_KEY === 'true';

function isLocalRequest(req: http.IncomingMessage) {
    const addr = req.socket.remoteAddress;
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

async function validateGuildChannelIds(client: Client, guildId: string, channelIds: string[]) {
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return false;

    for (const channelId of channelIds) {
        const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return false;
    }

    return true;
}

async function readBody(req: http.IncomingMessage) {
    return new Promise<string>((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => {
            data += chunk;
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

type ApiTrack = {
    encoded?: string;
    title: string;
    author?: string | null;
    uri?: string | null;
    artworkUrl?: string | null;
    durationMs?: number | null;
    sourceName?: string | null;
};

function serializeTrack(track: any): ApiTrack {
    const info = track?.info || {};
    return {
        encoded: track?.encoded,
        title: info.title || 'Unknown',
        author: info.author || null,
        uri: info.uri || null,
        artworkUrl: info.artworkUrl || null,
        durationMs: info.duration ?? info.length ?? null,
        sourceName: info.sourceName || null,
    };
}

function buildQueueState(player: any) {
    const current = player?.queue?.current ? serializeTrack(player.queue.current) : null;
    const tracks = Array.isArray(player?.queue?.tracks) ? player.queue.tracks.map(serializeTrack) : [];
    return {
        current,
        tracks,
        paused: !!player?.paused,
        volume: typeof player?.volume === 'number' ? player.volume : null,
        positionMs: typeof player?.position === 'number' ? player.position : null,
        repeatMode: player?.repeatMode || 'off',
    };
}

function normalizeSearchValue(value: string) {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ё/g, 'е')
        .replace(/Ё/g, 'е')
        .replace(/[<@#!>]/g, ' ')
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/giu, ' ')
        .trim();
}

function extractSnowflake(value: string) {
    return value.match(/\d{15,25}/)?.[0] || '';
}

function levenshtein(left: string, right: string) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    const current = new Array<number>(right.length + 1);

    for (let i = 1; i <= left.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + cost,
            );
        }

        for (let j = 0; j <= right.length; j += 1) {
            previous[j] = current[j];
        }
    }

    return previous[right.length];
}

function scoreSearchCandidate(rawQuery: string, candidate: string) {
    const query = normalizeSearchValue(rawQuery);
    const normalized = normalizeSearchValue(candidate);
    if (!query || !normalized) return 0;
    if (normalized === query) return 1;
    if (normalized.startsWith(query)) return 0.94;
    if (normalized.includes(query)) return 0.88;

    let best = 0;
    const queryWords = query.split(' ').filter(Boolean);
    const candidateWords = normalized.split(' ').filter(Boolean);
    for (const queryWord of queryWords.length ? queryWords : [query]) {
        for (const candidateWord of candidateWords.length ? candidateWords : [normalized]) {
            const longest = Math.max(queryWord.length, candidateWord.length);
            if (!longest) continue;
            const score = 1 - levenshtein(queryWord, candidateWord) / longest;
            if (score > best) best = score;
        }
    }

    return best * 0.8;
}

function bestSearchScore(rawQuery: string, candidates: Array<string | null | undefined>) {
    const queryId = extractSnowflake(rawQuery);
    let best = 0;

    for (const candidate of candidates) {
        if (!candidate) continue;
        if (queryId && candidate === queryId) {
            return 1.2;
        }
        best = Math.max(best, scoreSearchCandidate(rawQuery, candidate));
    }

    return best;
}

function serializeSearchMember(member: any) {
    const user = member.user;
    const topRole = member.roles.highest.id !== member.guild.id
        ? member.roles.highest
        : member.roles.cache
            .filter((role: any) => role.id !== member.guild.id)
            .sort((left: any, right: any) => right.position - left.position)
            .first() ?? null;

    return {
        id: user.id,
        name: member.displayName,
        username: user.username,
        discriminator: user.discriminator,
        tag: user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : `@${user.username}`,
        avatar: member.displayAvatarURL({ size: 64, extension: 'webp' }),
        globalName: user.globalName || user.username,
        roleName: topRole?.name ?? null,
        roleColor: topRole?.color || null,
    };
}

function serializeSearchChannel(guild: any, channel: any) {
    const parent = channel.parentId ? guild.channels.cache.get(channel.parentId) : null;
    return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        categoryName: parent && 'name' in parent ? parent.name : null,
    };
}

async function searchGuildMembers(guild: any, rawQuery: string, limit: number) {
    const matches = new Map<string, { score: number; member: any }>();
    const queryId = extractSnowflake(rawQuery);

    const addMember = (member: any, score: number) => {
        if (!member?.user?.id) return;
        const current = matches.get(member.user.id);
        if (!current || score > current.score) {
            matches.set(member.user.id, { score, member });
        }
    };

    if (queryId) {
        const cached = guild.members.cache.get(queryId);
        if (cached) {
            addMember(cached, 1.2);
        } else {
            const fetched = await guild.members.fetch(queryId).catch(() => null);
            if (fetched) addMember(fetched, 1.2);
        }
    }

    guild.members.cache.forEach((member: any) => {
        const score = bestSearchScore(rawQuery, [
            member.id,
            member.displayName,
            member.nickname,
            member.user.username,
            member.user.globalName,
            member.user.tag,
        ]);

        if (score >= 0.44) {
            addMember(member, score);
        }
    });

    if (!queryId && rawQuery.trim().length >= 2) {
        const searched = await guild.members.search({ query: rawQuery.trim(), limit: Math.max(limit, 10), cache: true }).catch(() => null);
        searched?.forEach((member: any) => addMember(member, Math.max(0.9, bestSearchScore(rawQuery, [
            member.displayName,
            member.user.username,
            member.user.globalName,
            member.user.tag,
        ]))));
    }

    return Array.from(matches.values())
        .sort((left, right) => right.score - left.score || left.member.displayName.localeCompare(right.member.displayName))
        .slice(0, limit)
        .map(({ member }) => serializeSearchMember(member));
}

function searchGuildChannels(guild: any, rawQuery: string, limit: number) {
    return guild.channels.cache
        .filter((channel: any) => 'name' in channel)
        .map((channel: any) => {
            const parent = channel.parentId ? guild.channels.cache.get(channel.parentId) : null;
            const score = bestSearchScore(rawQuery, [
                channel.id,
                channel.name,
                parent && 'name' in parent ? parent.name : null,
            ]);

            return { channel, score };
        })
        .filter(({ score }: { score: number }) => score >= 0.44)
        .sort((left: any, right: any) => right.score - left.score || left.channel.position - right.channel.position)
        .slice(0, limit)
        .map(({ channel }: { channel: any }) => serializeSearchChannel(guild, channel));
}

export function startDashboardApi(client: Client): http.Server {
    if (!API_KEY && REQUIRE_API_KEY) {
        logger.error('[DashboardAPI] DASHBOARD_API_KEY is not set; privileged dashboard API requests will be rejected.');
    } else if (!API_KEY) {
        logger.warn('[DashboardAPI] DASHBOARD_API_KEY is not set; accepting local development requests only.');
    }

    const server = http.createServer(async (req, res) => {
        try {
            if (!isLocalRequest(req)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            if (!API_KEY && REQUIRE_API_KEY) {
                res.writeHead(503);
                res.end('Dashboard API key is not configured');
                return;
            }

            const headerKey = req.headers['x-dashboard-key'];
            if (API_KEY && headerKey !== API_KEY) {
                res.writeHead(401);
                res.end('Unauthorized');
                return;
            }

            const url = new URL(req.url || '/', 'http://127.0.0.1');

            if (url.pathname === '/api/shutdown') {
                if (req.method !== 'POST') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, message: 'Shutting down bot' }));

                // Defer to let response flush, then reuse SIGINT handler for graceful stop
                setTimeout(() => {
                    logger.info('[DashboardAPI] Shutdown requested via API');
                    process.emit('SIGINT');
                }, 50);
                return;
            }

            if (url.pathname === '/api/queue') {
                if (req.method === 'GET') {
                    const guildId = url.searchParams.get('guildId') || '';
                    if (!guildId) {
                        res.writeHead(400);
                        res.end('guildId is required');
                        return;
                    }

                    const player = client.lavalink.getPlayer(guildId);
                    if (!player) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: true, queue: { current: null, tracks: [] } }));
                        return;
                    }

                    const queue = buildQueueState(player);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, queue }));
                    return;
                }

                if (req.method !== 'POST') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const guildId = typeof body.guildId === 'string' ? body.guildId : '';
                const encodedTrack = typeof body.encodedTrack === 'string' ? body.encodedTrack : '';
                const action = typeof body.action === 'string' ? body.action : '';

                if (!guildId) {
                    res.writeHead(400);
                    res.end('guildId is required');
                    return;
                }

                const player = client.lavalink.getPlayer(guildId);
                if (!player) {
                    res.writeHead(404);
                    res.end('Player not found');
                    return;
                }

                if (!player.connected && player.voiceChannelId) {
                    await player.connect();
                }

                if (encodedTrack) {
                    const requester = client.user || undefined;
                    const track = await player.node.decode.singleTrack(encodedTrack, requester);
                    await player.queue.add(track);
                    if (!player.playing) await player.play();
                    logger.info(`[DashboardAPI] Queued track for guild ${guildId}: ${track.info?.title || 'Unknown'}`);
                    const queue = buildQueueState(player);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, queued: serializeTrack(track), queue }));
                    return;
                }

                if (!action) {
                    res.writeHead(400);
                    res.end('encodedTrack or action is required');
                    return;
                }

                if (action === 'clear') {
                    player.queue.tracks.length = 0;
                    await player.queue.utils.save();
                    const queue = buildQueueState(player);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, queue }));
                    return;
                }

                if (action === 'shuffle') {
                    await player.queue.shuffle();
                    const queue = buildQueueState(player);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, queue }));
                    return;
                }

                if (action === 'remove') {
                    const index = Number(body.index);
                    if (!Number.isInteger(index)) {
                        res.writeHead(400);
                        res.end('index is required');
                        return;
                    }
                    await player.queue.splice(index, 1);
                    const queue = buildQueueState(player);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, queue }));
                    return;
                }

                if (action === 'move') {
                    const from = Number(body.from);
                    const to = Number(body.to);
                    if (!Number.isInteger(from) || !Number.isInteger(to)) {
                        res.writeHead(400);
                        res.end('from and to are required');
                        return;
                    }
                    const trackCount = player.queue.tracks.length;
                    if (from < 0 || from >= trackCount) {
                        res.writeHead(400);
                        res.end('from is out of range');
                        return;
                    }
                    if (from === to) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: true, queue: buildQueueState(player) }));
                        return;
                    }
                    const track = await player.queue.splice(from, 1);
                    const maxIndex = trackCount;
                    const safeTo = Math.max(0, Math.min(to, maxIndex));
                    const target = from < safeTo ? Math.max(0, safeTo - 1) : safeTo;
                    if (track) {
                        await player.queue.splice(target, 0, track);
                    }
                    const queue = buildQueueState(player);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, queue }));
                    return;
                }

                res.writeHead(400);
                res.end('Unknown action');
                return;
            }

            if (url.pathname === '/api/audit/events') {
                if (req.method !== 'GET') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                const guildId = url.searchParams.get('guildId') || '';
                if (!guildId) {
                    res.writeHead(400);
                    res.end('guildId is required');
                    return;
                }

                const tag = url.searchParams.get('tag') || undefined;
                const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
                const beforeId = Number(url.searchParams.get('beforeId') || 0);
                const userId = url.searchParams.get('userId') || undefined;
                const actorId = url.searchParams.get('actorId') || undefined;
                const targetId = url.searchParams.get('targetId') || undefined;
                const channelId = url.searchParams.get('channelId') || undefined;

                const where: any = { guildId };
                if (tag) where.tag = tag;
                if (beforeId) where.id = { lt: beforeId };
                if (userId) where.OR = [{ actorId: userId }, { targetId: userId }];
                if (actorId) where.actorId = actorId;
                if (targetId) where.targetId = targetId;
                if (channelId) where.channelId = channelId;

                const rows = await statsPrisma.auditLogEvent.findMany({
                    where,
                    orderBy: { id: 'desc' },
                    take: limit,
                });

                const data = rows.map((row: any) => ({
                    ...row,
                    payload: row.payload ? safeJson(row.payload) : null,
                }));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, events: data }));
                return;
            }

            if (url.pathname === '/api/audit/messages') {
                if (req.method !== 'GET') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                const guildId = url.searchParams.get('guildId') || '';
                if (!guildId) {
                    res.writeHead(400);
                    res.end('guildId is required');
                    return;
                }

                const eventType = url.searchParams.get('eventType') || undefined;
                const channelId = url.searchParams.get('channelId') || undefined;
                const authorId = url.searchParams.get('authorId') || undefined;
                const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
                const beforeId = Number(url.searchParams.get('beforeId') || 0);

                const where: any = { guildId };
                if (eventType) where.eventType = eventType;
                if (channelId) where.channelId = channelId;
                if (authorId) where.authorId = authorId;
                if (beforeId) where.id = { lt: beforeId };

                const rows = await statsPrisma.messageEvent.findMany({
                    where,
                    orderBy: { id: 'desc' },
                    take: limit,
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, events: rows }));
                return;
            }

            if (url.pathname === '/api/audit/routes') {
                const guildId = url.searchParams.get('guildId') || '';
                if (!guildId) {
                    res.writeHead(400);
                    res.end('guildId is required');
                    return;
                }

                if (req.method === 'GET') {
                    const routes = await prisma.auditTagRoute.findMany({
                        where: { guildId },
                        orderBy: { tag: 'asc' },
                    });
                    const normalizedRoutes = routes.map((route) => ({
                        ...route,
                        channelIds: parseAuditRouteChannelIds(route.channelId),
                    }));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, routes: normalizedRoutes }));
                    return;
                }

                if (req.method === 'POST') {
                    const raw = await readBody(req);
                    const body = raw ? JSON.parse(raw) : {};
                    const tags = Array.from(
                        new Set(
                            [
                                ...(typeof body.tag === 'string' ? [body.tag] : []),
                                ...(Array.isArray(body.tags) ? body.tags : []),
                            ]
                                .filter((tag): tag is string => typeof tag === 'string')
                                .map((tag) => tag.trim())
                                .filter(Boolean)
                        )
                    );
                    const channelIds = Array.from(
                        new Set(
                            [
                                ...(typeof body.channelId === 'string' ? [body.channelId] : []),
                                ...(Array.isArray(body.channelIds) ? body.channelIds : []),
                            ]
                                .filter((channelId): channelId is string => typeof channelId === 'string')
                                .map((channelId) => channelId.trim())
                                .filter(Boolean)
                        )
                    );
                    const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;
                    const hasTemplate = Object.prototype.hasOwnProperty.call(body, 'template');
                    const template = typeof body.template === 'string' ? body.template : null;
                    const hasMentions = Object.prototype.hasOwnProperty.call(body, 'mentions');
                    const mentions = body.mentions ? JSON.stringify(body.mentions) : null;

                    if (tags.length === 0 || channelIds.length === 0) {
                        res.writeHead(400);
                        res.end('tags and channelIds are required');
                        return;
                    }

                    if (!await validateGuildChannelIds(client, guildId, channelIds)) {
                        res.writeHead(400);
                        res.end('channelIds must belong to the requested guild');
                        return;
                    }

                    const serializedChannelIds = serializeAuditRouteChannelIds(channelIds);
                    const routes = await prisma.$transaction(
                        tags.map((tag) =>
                            prisma.auditTagRoute.upsert({
                                where: { guildId_tag: { guildId, tag } },
                                update: {
                                    channelId: serializedChannelIds,
                                    ...(typeof enabled === 'boolean' ? { enabled } : {}),
                                    ...(hasTemplate ? { template } : {}),
                                    ...(hasMentions ? { mentions } : {}),
                                },
                                create: {
                                    guildId,
                                    tag,
                                    channelId: serializedChannelIds,
                                    enabled: enabled ?? true,
                                    template: hasTemplate ? template : null,
                                    mentions: hasMentions ? mentions : null,
                                },
                            })
                        )
                    );
                    const normalizedRoutes = routes.map((route) => ({
                        ...route,
                        channelIds: parseAuditRouteChannelIds(route.channelId),
                    }));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        ok: true,
                        route: normalizedRoutes[0] ?? null,
                        routes: normalizedRoutes,
                    }));
                    return;
                }

                if (req.method === 'DELETE') {
                    const raw = await readBody(req);
                    const body = raw ? JSON.parse(raw) : {};
                    const tags = Array.from(
                        new Set(
                            [
                                ...(url.searchParams.get('tag') ? [url.searchParams.get('tag')] : []),
                                ...(typeof body.tag === 'string' ? [body.tag] : []),
                                ...(Array.isArray(body.tags) ? body.tags : []),
                            ]
                                .filter((tag): tag is string => typeof tag === 'string')
                                .map((tag) => tag.trim())
                                .filter(Boolean)
                        )
                    );
                    if (tags.length === 0) {
                        res.writeHead(400);
                        res.end('tag or tags are required');
                        return;
                    }
                    const result = await prisma.auditTagRoute.deleteMany({
                        where: {
                            guildId,
                            tag: { in: tags },
                        },
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, count: result.count }));
                    return;
                }

                res.writeHead(405);
                res.end('Method Not Allowed');
                return;
            }


            // /api/enrich — resolve user/channel info from Discord cache
            if (url.pathname === '/api/appeals/review') {
                if (req.method !== 'POST') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const guildId = typeof body.guildId === 'string' ? body.guildId : '';
                const reviewerId = typeof body.reviewerId === 'string' ? body.reviewerId.trim() : '';
                const ticketId = Number(body.ticketId);
                const note = typeof body.note === 'string' && body.note.trim().length ? body.note.trim() : null;
                const decision = typeof body.decision === 'string' ? body.decision.trim().toUpperCase() : '';

                if (!guildId || !reviewerId || !Number.isInteger(ticketId) || ticketId < 1 || !decision) {
                    res.writeHead(400);
                    res.end('guildId, reviewerId, ticketId and decision are required');
                    return;
                }

                if (!['IN_REVIEW', 'ACCEPTED', 'REJECTED', 'PARDONED'].includes(decision)) {
                    res.writeHead(400);
                    res.end('Invalid decision');
                    return;
                }

                const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) {
                    res.writeHead(404);
                    res.end('Guild not found');
                    return;
                }

                try {
                    const ticket = await reviewAppealTicket({
                        guild,
                        ticketId,
                        reviewerId,
                        decision: decision as 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'PARDONED',
                        note,
                        client,
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, ticket }));
                    return;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to review appeal ticket';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                    return;
                }
            }

            if (url.pathname === '/api/appeals/sync-panel') {
                if (req.method !== 'POST') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const guildId = typeof body.guildId === 'string' ? body.guildId : '';

                if (!guildId) {
                    res.writeHead(400);
                    res.end('guildId is required');
                    return;
                }

                try {
                    const result = await syncAppealPanels(client, guildId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, result }));
                    return;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to sync appeal panel';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                    return;
                }
            }

            // --- Ticket Module Bridge ---

            if (url.pathname === '/api/tickets/sync-panel') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const guildId = typeof body.guildId === 'string' ? body.guildId : '';
                const categoryId = typeof body.categoryId === 'number' ? body.categoryId : null;
                if (!guildId) { res.writeHead(400); res.end('guildId is required'); return; }
                try {
                    if (categoryId !== null) {
                        const result = await syncTicketPanel(client, guildId, categoryId);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: true, results: [result] }));
                    } else {
                        await syncAllTicketPanels(client, guildId);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: true, results: [] }));
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to sync ticket panel';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/tickets/preview-panel') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const guildId = typeof body.guildId === 'string' ? body.guildId : '';
                const categoryId = typeof body.categoryId === 'number' ? body.categoryId : null;
                const channelId = typeof body.channelId === 'string' && body.channelId.trim() ? body.channelId.trim() : null;
                const messageDesignJson = typeof body.messageDesignJson === 'string' ? body.messageDesignJson : null;
                if (!guildId || categoryId === null) { res.writeHead(400); res.end('guildId and categoryId are required'); return; }
                try {
                    const result = await sendTicketPanelPreview(client, guildId, categoryId, messageDesignJson, channelId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, ...result }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to send ticket panel preview';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/tickets/close') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const { guildId, ticketId, reason } = body as { guildId: string; ticketId: number; reason?: string };
                if (!guildId || !ticketId) { res.writeHead(400); res.end('guildId and ticketId required'); return; }
                try {
                    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
                    const { closeTicket } = await import('../services/TicketService');
                    await closeTicket({ client, guild, ticketId, actorId: 'dashboard', reason: reason ?? null });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/tickets/action') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const { guildId, ticketId, action, actorId } = body as { guildId: string; ticketId: number; action: string; actorId?: string };
                if (!guildId || !ticketId || !action) { res.writeHead(400); res.end('guildId, ticketId, action required'); return; }
                try {
                    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
                    const svc = await import('../services/TicketService');
                    const opts = { client, guild, ticketId, actorId: actorId ?? 'dashboard' };
                    if (action === 'claim') await svc.claimTicket(opts);
                    else if (action === 'unclaim') await svc.unclaimTicket(opts);
                    else if (action === 'hold') await svc.setTicketOnHold(opts);
                    else if (action === 'resume') await svc.resumeTicket(opts);
                    else if (action === 'reopen') await svc.reopenTicket(opts);
                    else { res.writeHead(400); res.end('Unknown action'); return; }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/tickets/priority') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const { guildId, ticketId, priorityId, actorId } = body as { guildId: string; ticketId: number; priorityId: number; actorId?: string };
                if (!guildId || !ticketId || !priorityId) { res.writeHead(400); res.end('guildId, ticketId, priorityId required'); return; }
                try {
                    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
                    const svc = await import('../services/TicketSaasService');
                    await svc.setTicketPriority({ guildId, ticketId, priorityId, actorId: actorId ?? 'dashboard' });
                    await svc.notifyTicketEvent(client, guild, ticketId, 'PRIORITY_CHANGED');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/tickets/transfer') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const { guildId, ticketId, fromUserId, toUserId, note } = body as { guildId: string; ticketId: number; fromUserId?: string; toUserId?: string; note?: string };
                if (!guildId || !ticketId || !fromUserId || !toUserId) { res.writeHead(400); res.end('guildId, ticketId, fromUserId, toUserId required'); return; }
                try {
                    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
                    const svc = await import('../services/TicketSaasService');
                    const request = await svc.createTransferRequest({ guildId, ticketId, fromUserId, toUserId, note: note ?? null });
                    await svc.postTransferRequestPrompt(guild, ticketId, request.id);
                    await svc.notifyTicketEvent(client, guild, ticketId, 'TRANSFER_REQUESTED');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, request }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/tickets/transfer/resolve') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const { guildId, ticketId, requestId, actorId, accept } = body as { guildId: string; ticketId: number; requestId: number; actorId?: string; accept?: boolean };
                if (!guildId || !ticketId || !requestId || !actorId || typeof accept !== 'boolean') { res.writeHead(400); res.end('guildId, ticketId, requestId, actorId, accept required'); return; }
                try {
                    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
                    const svc = await import('../services/TicketSaasService');
                    const request = await prisma.ticketTransferRequest.findFirst({ where: { id: requestId, guildId, ticketId } });
                    await svc.resolveTransferRequest({ guildId, ticketId, requestId, actorId, accept });
                    if (accept && request) {
                        await svc.applyTransferThreadAccess(guild, ticketId, request.fromUserId, request.toUserId);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/tickets/note') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const { guildId, ticketId, authorId, body: noteBody } = body as { guildId: string; ticketId: number; authorId?: string; body?: string };
                if (!guildId || !ticketId || !authorId || !noteBody?.trim()) { res.writeHead(400); res.end('guildId, ticketId, authorId, body required'); return; }
                try {
                    const svc = await import('../services/TicketSaasService');
                    const note = await svc.addTicketInternalNote({ guildId, ticketId, authorId, body: noteBody.trim() });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, note }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/economy/grant') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const { guildId, userId, account, amount, reason, mode, actorId } = body as { guildId: string; userId: string; account: 'WALLET' | 'BANK'; amount: string | number; reason?: string; mode: 'grant' | 'deduct'; actorId?: string };
                if (!guildId || !userId || !account || amount === undefined || !mode) { res.writeHead(400); res.end('guildId, userId, account, amount, mode required'); return; }
                try {
                    const { EconomyService } = await import('../services/EconomyService');
                    const params = {
                        guildId,
                        userId,
                        account,
                        amount: BigInt(amount),
                        type: (mode === 'grant' ? 'ADMIN_GRANT' : 'ADMIN_DEDUCT') as 'ADMIN_GRANT' | 'ADMIN_DEDUCT',
                        actorId: actorId ?? 'dashboard',
                        metadata: reason ? { reason } : undefined,
                    };
                    const result = mode === 'grant'
                        ? await EconomyService.credit(params, client)
                        : await EconomyService.debit(params, client);
                    if (!result.ok) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: false, error: result.reason }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/economy/season-end') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const { guildId, resetBalances } = body as { guildId: string; resetBalances?: boolean };
                if (!guildId) { res.writeHead(400); res.end('guildId required'); return; }
                try {
                    const { EconomySeasonService } = await import('../services/EconomySeasonService');
                    const result = await EconomySeasonService.endSeason(guildId, { resetBalances: !!resetBalances, client });
                    if (!result.ok) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: false, error: result.reason }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/economy/invalidate-cache') {
                if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const { guildId } = body as { guildId: string };
                if (!guildId) { res.writeHead(400); res.end('guildId required'); return; }
                try {
                    const { EconomyService } = await import('../services/EconomyService');
                    EconomyService.invalidateCache(guildId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
                return;
            }

            if (url.pathname === '/api/enrich') {
                if (req.method !== 'POST') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                const raw = await readBody(req);
                const body = raw ? JSON.parse(raw) : {};
                const guildId = typeof body.guildId === 'string' ? body.guildId : '';
                const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : [];
                const channelIds: string[] = Array.isArray(body.channelIds) ? body.channelIds : [];

                if (!guildId) {
                    res.writeHead(400);
                    res.end('guildId is required');
                    return;
                }

                const guild = client.guilds.cache.get(guildId);
                const users: Record<string, any> = {};
                const channels: Record<string, any> = {};

                // Resolve users
                for (const userId of userIds) {
                    try {
                        // Try guild member first (get server nickname)
                        let member = guild?.members.cache.get(userId);
                        if (!member && guild) {
                            try { member = await guild.members.fetch(userId); } catch { /* member left the guild — fall through to user lookup */ }
                        }

                        if (member) {
                            const user = member.user;
                            const avatarUrl = member.displayAvatarURL({ size: 64, extension: 'webp' });
                            const topRole = member.roles.highest.id !== member.guild.id
                                ? member.roles.highest
                                : member.roles.cache
                                    .filter((role) => role.id !== member.guild.id)
                                    .sort((left, right) => right.position - left.position)
                                    .first() ?? null;
                            users[userId] = {
                                id: userId,
                                name: member.displayName,           // server nickname or username
                                username: user.username,
                                discriminator: user.discriminator,
                                tag: user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : `@${user.username}`,
                                avatar: avatarUrl,
                                globalName: user.globalName || user.username,
                                roleName: topRole?.name ?? null,
                                roleColor: topRole?.color || null,
                            };
                        } else {
                            // Fallback: try to fetch user globally
                            try {
                                const user = await client.users.fetch(userId);
                                users[userId] = {
                                    id: userId,
                                    name: user.globalName || user.username,
                                    username: user.username,
                                    discriminator: user.discriminator,
                                    tag: user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : `@${user.username}`,
                                    avatar: user.displayAvatarURL({ size: 64, extension: 'webp' }),
                                    globalName: user.globalName || user.username,
                                    roleName: null,
                                    roleColor: null,
                                };
                            } catch {
                                users[userId] = { id: userId, name: userId, username: userId, tag: userId, avatar: null, roleName: null, roleColor: null };
                            }
                        }
                    } catch {
                        users[userId] = { id: userId, name: userId, username: userId, tag: userId, avatar: null, roleName: null, roleColor: null };
                    }
                }

                // Resolve channels
                for (const channelId of channelIds) {
                    const channel = guild?.channels.cache.get(channelId);
                    if (channel && 'name' in channel) {
                        channels[channelId] = {
                            id: channelId,
                            name: channel.name,
                            type: channel.type,
                        };
                    } else {
                        channels[channelId] = { id: channelId, name: channelId, type: null };
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, users, channels }));
                return;
            }

            // /api/search — search guild members/channels by id, nickname, username, global name, tag, or channel name.
            if (url.pathname === '/api/search') {
                if (req.method !== 'GET') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                const guildId = url.searchParams.get('guildId') || '';
                const query = (url.searchParams.get('q') || '').trim();
                const type = url.searchParams.get('type') || 'users'; // users | channels | all
                const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 25) || 25, 1), 50);

                if (!guildId || !query) {
                    res.writeHead(400);
                    res.end('guildId and q are required');
                    return;
                }

                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    res.writeHead(404);
                    res.end('Guild not found');
                    return;
                }

                if (type === 'users') {
                    const results = await searchGuildMembers(guild, query, limit);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, results }));
                    return;
                }

                if (type === 'channels') {
                    const results = searchGuildChannels(guild, query, limit);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, results }));
                    return;
                }

                if (type === 'all') {
                    const [users, channels] = await Promise.all([
                        searchGuildMembers(guild, query, limit),
                        Promise.resolve(searchGuildChannels(guild, query, limit)),
                    ]);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, users, channels }));
                    return;
                }

                res.writeHead(400);
                res.end('Invalid type');
                return;
            }

            // /api/stats/historical-sync — collect historical messages from Discord channels
            if (url.pathname === '/api/stats/historical-sync') {
                const { HistoricalSyncService } = await import('../services/HistoricalSyncService');

                if (req.method === 'GET') {
                    const guildId = url.searchParams.get('guildId') || '';
                    if (!guildId) {
                        res.writeHead(400);
                        res.end('guildId is required');
                        return;
                    }
                    const running = HistoricalSyncService.isSyncRunning(guildId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, running }));
                    return;
                }

                if (req.method === 'POST') {
                    const raw = await readBody(req);
                    const body = raw ? JSON.parse(raw) : {};
                    const guildId = typeof body.guildId === 'string' ? body.guildId : '';
                    const days = Math.min(Number(body.days) || 90, 90);

                    if (!guildId) {
                        res.writeHead(400);
                        res.end('guildId is required');
                        return;
                    }

                    // SSE stream for progress
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    });

                    const sendEvent = (data: any) => {
                        try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* client disconnected */ }
                    };

                    // Heartbeat to keep connection alive during long syncs
                    const heartbeat = setInterval(() => {
                        try { res.write(': heartbeat\n\n'); } catch { /* client disconnected */ }
                    }, 15_000);

                    try {
                        logger.info(`[HistoricalSync] Starting for guild ${guildId}, ${days} days`);
                        const result = await HistoricalSyncService.collectHistoricalData(
                            client,
                            guildId,
                            days,
                            (progress) => sendEvent({ type: 'progress', ...progress })
                        );
                        logger.info(`[HistoricalSync] Done: ${result.messagesCollected} new messages`);
                        sendEvent({ type: 'complete', ...result });
                    } catch (error) {
                        logger.error('[HistoricalSync] Error:', error);
                        sendEvent({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
                    } finally {
                        clearInterval(heartbeat);
                    }

                    res.end();
                    return;
                }

                res.writeHead(405);
                res.end('Method Not Allowed');
                return;
            }

            res.writeHead(404);
            res.end('Not Found');
            return;
        } catch (error) {
            logger.error('[DashboardAPI] Error:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    });

    server.listen(PORT, '127.0.0.1', () => {
        logger.info(`[DashboardAPI] Listening on http://127.0.0.1:${PORT}`);
    });

    return server;
}

function safeJson(value: string) {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}
