import http from 'http';
import { Client } from 'discord.js';
import logger from './logger';

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

            res.writeHead(404);
            res.end('Not Found');
            return;
        } catch (error) {
            logger.error('[DashboardAPI] Queue error:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    });

    server.listen(PORT, '127.0.0.1', () => {
        logger.info(`[DashboardAPI] Listening on http://127.0.0.1:${PORT}`);
    });

    return server;
}
