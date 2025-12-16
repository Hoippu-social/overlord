import { NextResponse } from 'next/server';
import botManager from '@/lib/botProcess';

export async function GET() {
    try {
        const stats = await botManager.getStats();

        // stats object from botManager now contains everything we need
        // structure: { status, lavalink, bot, cpu, memory, uptime, ping ... }

        return NextResponse.json({
            cpu: stats.cpu || 0,
            memory: stats.memory || 0,
            uptime: stats.uptime || '0s',
            ping: stats.ping || 0,
            botStatus: stats.status,
            modules: {
                discord: stats.bot,
                lavalink: stats.lavalink,
                database: true // TODO: check db connection
            }
        });
    } catch (error) {
        console.error('Failed to get stats:', error);
        return NextResponse.json({
            cpu: 0,
            memory: 0,
            uptime: '0s',
            ping: 0,
            botStatus: 'OFFLINE',
            modules: {
                discord: false,
                lavalink: false,
                database: false
            }
        });
    }
}

export async function POST(req: Request) {
    const { action } = await req.json();

    try {
        switch (action) {
            case 'start':
                await botManager.startBot();
                break;
            case 'stop':
                await botManager.stopBot();
                break;
            case 'restart':
                await botManager.restartBot();
                break;
            case 'kill':
                await botManager.forceKill();
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
