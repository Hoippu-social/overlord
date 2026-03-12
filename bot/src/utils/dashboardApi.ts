import http from 'http';
import { Client } from 'discord.js';
import logger from './logger';
import { prisma, statsPrisma } from './database';

const PORT = Number.parseInt(process.env.DASHBOARD_API_PORT || '3002', 10);
const API_KEY = process.env.DASHBOARD_API_KEY || '';

function isLocalRequest(req: http.IncomingMessage) {
    const addr = req.socket.remoteAddress;
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
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

export function startDashboardApi(client: Client): http.Server {
    const server = http.createServer(async (req, res) => {
        try {
            if (!isLocalRequest(req)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            if (API_KEY) {
                const headerKey = req.headers['x-dashboard-key'];
                if (!headerKey || headerKey !== API_KEY) {
                    res.writeHead(401);
                    res.end('Unauthorized');
                    return;
                }
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

                const where: any = { guildId };
                if (tag) where.tag = tag;
                if (beforeId) where.id = { lt: beforeId };

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
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, routes }));
                    return;
                }

                if (req.method === 'POST') {
                    const raw = await readBody(req);
                    const body = raw ? JSON.parse(raw) : {};
                    const tag = typeof body.tag === 'string' ? body.tag : '';
                    const channelId = typeof body.channelId === 'string' ? body.channelId : '';
                    const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
                    const template = typeof body.template === 'string' ? body.template : null;
                    const mentions = body.mentions ? JSON.stringify(body.mentions) : null;

                    if (!tag || !channelId) {
                        res.writeHead(400);
                        res.end('tag and channelId are required');
                        return;
                    }

                    const route = await prisma.auditTagRoute.upsert({
                        where: { guildId_tag: { guildId, tag } },
                        update: { channelId, enabled, template, mentions },
                        create: { guildId, tag, channelId, enabled, template, mentions },
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, route }));
                    return;
                }

                if (req.method === 'DELETE') {
                    const raw = await readBody(req);
                    const body = raw ? JSON.parse(raw) : {};
                    const tag = typeof body.tag === 'string' ? body.tag : url.searchParams.get('tag') || '';
                    if (!tag) {
                        res.writeHead(400);
                        res.end('tag is required');
                        return;
                    }
                    await prisma.auditTagRoute.delete({
                        where: { guildId_tag: { guildId, tag } },
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
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
                            try { member = await guild.members.fetch(userId); } catch { }
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
                    const channel = guild?.channels.cache.get(channelId) || client.channels.cache.get(channelId);
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

            // /api/search — search guild members by nickname, username or tag
            if (url.pathname === '/api/search') {
                if (req.method !== 'GET') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                const guildId = url.searchParams.get('guildId') || '';
                const query = (url.searchParams.get('q') || '').toLowerCase().trim();
                const type = url.searchParams.get('type') || 'users'; // users | channels

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
                    // Search in cache first
                    const results = guild.members.cache
                        .filter(m => {
                            const nick = m.displayName.toLowerCase();
                            const username = m.user.username.toLowerCase();
                            const tag = m.user.tag.toLowerCase();
                            return nick.includes(query) || username.includes(query) || tag.includes(query);
                        })
                        .map(m => ({
                            id: m.user.id,
                            name: m.displayName,
                            username: m.user.username,
                            tag: m.user.discriminator !== '0'
                                ? `${m.user.username}#${m.user.discriminator}`
                                : `@${m.user.username}`,
                            avatar: m.displayAvatarURL({ size: 64, extension: 'webp' }),
                        }))
                        .slice(0, 25);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, results: Array.from(results.values()) }));
                    return;
                }

                if (type === 'channels') {
                    const results = guild.channels.cache
                        .filter(c => 'name' in c && c.name!.toLowerCase().includes(query))
                        .map(c => ({
                            id: c.id,
                            name: (c as any).name,
                            type: c.type,
                        }))
                        .slice(0, 25);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, results: Array.from(results.values()) }));
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
                        try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { }
                    };

                    // Heartbeat to keep connection alive during long syncs
                    const heartbeat = setInterval(() => {
                        try { res.write(': heartbeat\n\n'); } catch { }
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
