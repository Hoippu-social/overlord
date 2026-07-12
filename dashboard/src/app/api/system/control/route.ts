import { NextRequest, NextResponse } from 'next/server';
import botManager from '@/lib/botProcess';
import { isSuperUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
    if (!(await isSuperUser(request))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { action } = await request.json();

        switch (action) {
            case 'toggle':
                const currentStatus = await botManager.getBotStatus();
                if (currentStatus === 'running') {
                    await botManager.stopBot();
                } else {
                    await botManager.startBot();
                }
                break;

            case 'reboot':
                await botManager.restartBot();
                break;

            case 'hardstop':
                await botManager.forceKill();
                break;

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Control action failed:', error);
        return NextResponse.json({ error: 'Action failed' }, { status: 500 });
    }
}
