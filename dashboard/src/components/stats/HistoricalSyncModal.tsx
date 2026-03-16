'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Progress, Spinner } from '@nextui-org/react';
import { Warning, ArrowsClockwise, CheckCircle, XCircle } from '@phosphor-icons/react';

interface HistoricalSyncProgress {
    phase: string;
    current: number;
    total: number;
    message: string;
    percentComplete: number;
}

interface HistoricalSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    guildId: string;
    selectedDays: number;
}

export function HistoricalSyncModal({ isOpen, onClose, guildId, selectedDays }: HistoricalSyncModalProps) {
    const [stage, setStage] = useState<'confirm' | 'syncing' | 'complete' | 'error'>('confirm');
    const [progress, setProgress] = useState<HistoricalSyncProgress | null>(null);
    const [result, setResult] = useState<{ messagesCollected: number; error?: string } | null>(null);
    const [warningShown, setWarningShown] = useState(false);

    const daysExceeded = selectedDays > 90;

    const resetState = useCallback(() => {
        setStage('confirm');
        setProgress(null);
        setResult(null);
        setWarningShown(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    const startSync = async () => {
        if (daysExceeded) {
            setWarningShown(true);
            return;
        }

        setStage('syncing');
        setProgress({
            phase: 'init',
            current: 0,
            total: 100,
            message: 'Подключение к серверу...',
            percentComplete: 0
        });

        try {
            const response = await fetch(`/api/guilds/${guildId}/stats/historical-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days: selectedDays })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Ошибка сервера');
            }

            // Read SSE stream
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const event = JSON.parse(line.slice(6));
                                if (event.type === 'progress') {
                                    setProgress({
                                        phase: event.phase,
                                        current: event.current,
                                        total: event.total,
                                        message: event.message,
                                        percentComplete: event.percentComplete
                                    });
                                } else if (event.type === 'complete') {
                                    setResult({ messagesCollected: event.messagesCollected || 0 });
                                    setStage('complete');
                                } else if (event.type === 'error') {
                                    throw new Error(event.error);
                                }
                            } catch (e) {
                                if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
                            }
                        }
                    }
                }
            }

            if (stage !== 'complete' && stage !== 'error') {
                setStage('complete');
                if (!result) setResult({ messagesCollected: 0 });
            }

        } catch (err) {
            console.error('Historical sync error:', err);
            setResult({ messagesCollected: 0, error: err instanceof Error ? err.message : 'Неизвестная ошибка' });
            setStage('error');
        }
    };

    const handleClose = () => {
        if (stage !== 'syncing') {
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            isDismissable={stage !== 'syncing'}
            hideCloseButton={stage === 'syncing'}
            classNames={{
                base: "bg-[#18181b] border border-white/10",
                header: "border-b border-white/10",
                body: "py-6",
                footer: "border-t border-white/10"
            }}
        >
            <ModalContent>
                {stage === 'confirm' && (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <ArrowsClockwise className="text-primary" size={24} />
                                <span>Сбор исторических данных</span>
                            </div>
                        </ModalHeader>
                        <ModalBody>
                            {daysExceeded || warningShown ? (
                                <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-lg">
                                    <Warning className="text-warning flex-shrink-0 mt-0.5" size={24} />
                                    <div>
                                        <p className="font-medium text-warning">Превышен лимит периода</p>
                                        <p className="text-sm text-default-400 mt-1">
                                            Для принудительного сбора период более 90 дней недоступен.
                                            Выберите период до 90 дней.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-default-400">
                                        Будут собраны данные за последние <strong className="text-white">{selectedDays}</strong> дней:
                                    </p>
                                    <ul className="list-disc list-inside text-default-400 space-y-1">
                                        <li>История сообщений из всех текстовых каналов</li>
                                        <li>Пересчёт статистики по часам и дням</li>
                                        <li>Обновление топов каналов и участников</li>
                                    </ul>
                                    <div className="flex items-start gap-3 p-4 bg-default-100 rounded-lg">
                                        <Warning className="text-default-400 flex-shrink-0 mt-0.5" size={20} />
                                        <p className="text-sm text-default-400">
                                            Голосовая активность и игры не могут быть собраны исторически —
                                            Discord не хранит эти данные.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={onClose}>
                                Отмена
                            </Button>
                            {!daysExceeded && !warningShown && (
                                <Button color="primary" onPress={startSync}>
                                    <ArrowsClockwise size={18} />
                                    Начать сбор
                                </Button>
                            )}
                        </ModalFooter>
                    </>
                )}

                {stage === 'syncing' && progress && (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <Spinner size="sm" />
                                <span>Сбор данных...</span>
                            </div>
                        </ModalHeader>
                        <ModalBody>
                            <div className="space-y-4">
                                <Progress
                                    value={progress.percentComplete}
                                    color="primary"
                                    classNames={{
                                        base: "w-full",
                                        track: "bg-default-100",
                                        indicator: "bg-gradient-to-r from-primary to-secondary"
                                    }}
                                />
                                <p className="text-center text-default-400">
                                    {progress.message}
                                </p>
                                {progress.phase === 'fetching' && (
                                    <p className="text-center text-xs text-default-500">
                                        Канал {progress.current} из {progress.total}
                                    </p>
                                )}
                            </div>
                        </ModalBody>
                    </>
                )}

                {stage === 'complete' && result && (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-success">
                                <CheckCircle size={24} />
                                <span>Сбор завершён</span>
                            </div>
                        </ModalHeader>
                        <ModalBody>
                            <div className="text-center py-4">
                                <p className="text-4xl font-bold text-white mb-2">
                                    {result.messagesCollected.toLocaleString()}
                                </p>
                                <p className="text-default-400">новых сообщений собрано</p>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button color="primary" onPress={onClose}>
                                Готово
                            </Button>
                        </ModalFooter>
                    </>
                )}

                {stage === 'error' && result && (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-danger">
                                <XCircle size={24} />
                                <span>Ошибка</span>
                            </div>
                        </ModalHeader>
                        <ModalBody>
                            <div className="flex items-start gap-3 p-4 bg-danger/10 border border-danger/20 rounded-lg">
                                <XCircle className="text-danger flex-shrink-0 mt-0.5" size={24} />
                                <p className="text-default-400">{result.error}</p>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={onClose}>
                                Закрыть
                            </Button>
                            <Button color="primary" onPress={() => setStage('confirm')}>
                                Попробовать снова
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
