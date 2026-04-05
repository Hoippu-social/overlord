import { NextRequest, NextResponse } from 'next/server';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import { withStatsTelemetry } from '@/lib/statsTelemetry';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:3002';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;

    return withStatsTelemetry({ guildId, endpoint: 'historical-sync:status', method: 'GET' }, async () => {
        const access = await requireGuildStatsAccess(request, guildId);
        if (!access.ok) {
            return access.response;
        }

        try {
            const response = await fetch(
                `${BOT_API_URL}/api/stats/historical-sync?guildId=${guildId}`,
                { method: 'GET' }
            );

            const data = await response.json();
            return NextResponse.json(data);
        } catch (error) {
            console.error('[HistoricalSync Status] Error:', error);
            return NextResponse.json({ ok: false, error: 'Бот недоступен' }, { status: 503 });
        }
    });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;

    return withStatsTelemetry({ guildId, endpoint: 'historical-sync', method: 'POST' }, async () => {
        const access = await requireGuildStatsAccess(request, guildId, { live: true });
        if (!access.ok) {
            return access.response;
        }

        try {
            const body = await request.json();
            const days = body.days || 30;

            if (days > 90) {
                return NextResponse.json(
                    {
                        ok: false,
                        error: 'Период более 90 дней недоступен для принудительного сбора',
                    },
                    { status: 400 }
                );
            }

            const botResponse = await fetch(`${BOT_API_URL}/api/stats/historical-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guildId, days }),
            });

            const contentType = botResponse.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const data = await botResponse.json();
                return NextResponse.json(data, { status: botResponse.status });
            }

            if (contentType.includes('text/event-stream')) {
                const reader = botResponse.body?.getReader();
                if (!reader) {
                    return NextResponse.json({ ok: false, error: 'Не удалось получить поток данных' }, { status: 500 });
                }

                const stream = new ReadableStream({
                    async start(controller) {
                        try {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                controller.enqueue(value);
                            }
                        } catch (error) {
                            console.error('[HistoricalSync SSE] Stream error:', error);
                        } finally {
                            controller.close();
                        }
                    },
                });

                return new Response(stream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        Connection: 'keep-alive',
                    },
                });
            }

            return NextResponse.json({ ok: false, error: 'Неожиданный ответ от бота' }, { status: 500 });
        } catch (error) {
            console.error('[HistoricalSync] Error:', error);
            return NextResponse.json({ ok: false, error: 'Бот недоступен' }, { status: 503 });
        }
    });
}
