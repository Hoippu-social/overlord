import { NextRequest, NextResponse } from 'next/server';
import botManager from '@/lib/botProcess';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
    if (!(await getAuthToken(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const stats = await botManager.getStats();

        let databaseConnected = false;
        try {
            await prisma.$queryRaw`SELECT 1`;
            databaseConnected = true;
        } catch (error) {
            console.error('Database health check failed:', error);
        }

        return NextResponse.json({
            cpu: stats.cpu ?? 0,
            memory: stats.memory ?? 0,
            totalMemory: stats.totalMemory ?? null,
            uptime: stats.uptime ?? '0s',
            ping: stats.ping ?? null,
            botStatus: stats.status,
            modules: {
                discord: stats.bot,
                lavalink: stats.lavalink,
                database: databaseConnected
            }
        });
    } catch (error) {
        console.error('Failed to get stats:', error);
        return NextResponse.json({
            cpu: 0,
            memory: 0,
            totalMemory: null,
            uptime: '0s',
            ping: null,
            botStatus: 'OFFLINE',
            modules: {
                discord: false,
                lavalink: false,
                database: false
            }
        });
    }
}

export async function POST(request: NextRequest) {
    if (!(await getAuthToken(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();

    try {
        switch (action) {
            case 'start':
                await botManager.start();
                break;
            case 'stop':
                await botManager.stop();
                break;
            case 'restart':
                await botManager.restart();
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
