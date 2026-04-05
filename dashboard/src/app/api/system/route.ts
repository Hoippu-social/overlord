import { NextRequest, NextResponse } from 'next/server';
import botManager from '@/lib/botProcess';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { getEmptyStorageDiagnostics, getStorageDiagnostics } from '@/lib/systemDiagnostics';
import { withTimeout } from '@/lib/requestTimeout';

export async function GET(request: NextRequest) {
    if (!(await getAuthToken(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const [statsResult, diagnosticsResult, databaseHealthResult] = await Promise.allSettled([
            withTimeout(() => botManager.getStats(), 4000, 'Bot stats'),
            withTimeout(() => getStorageDiagnostics(), 2500, 'Storage diagnostics'),
            withTimeout(async () => {
                await prisma.$queryRaw`SELECT 1`;
                return true;
            }, 2000, 'Database health check'),
        ]);

        const stats = statsResult.status === 'fulfilled'
            ? statsResult.value
            : {
                status: 'OFFLINE' as const,
                lavalink: false,
                bot: false,
                botPid: null,
                lavalinkPid: null,
                cpu: 0,
                memory: 0,
                totalMemory: null,
                uptime: '0s',
                ping: null,
            };
        const diagnostics = diagnosticsResult.status === 'fulfilled'
            ? diagnosticsResult.value
            : getEmptyStorageDiagnostics();
        const databaseConnected = databaseHealthResult.status === 'fulfilled' && databaseHealthResult.value;

        if (statsResult.status === 'rejected') {
            console.error('Failed to get bot stats:', statsResult.reason);
        }
        if (diagnosticsResult.status === 'rejected') {
            console.error('Failed to get storage diagnostics:', diagnosticsResult.reason);
        }
        if (databaseHealthResult.status === 'rejected') {
            console.error('Database health check failed:', databaseHealthResult.reason);
        }

        return NextResponse.json({
            cpu: stats.cpu ?? 0,
            memory: stats.memory ?? 0,
            totalMemory: stats.totalMemory ?? null,
            uptime: stats.uptime ?? '0s',
            ping: stats.ping ?? null,
            botStatus: stats.status,
            diagnostics,
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
            diagnostics: getEmptyStorageDiagnostics(),
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
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Action failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
