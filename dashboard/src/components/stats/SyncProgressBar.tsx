'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Progress, Card } from '@nextui-org/react';
import { CheckCircle, WarningCircle, SpinnerGap } from '@phosphor-icons/react';

/**
 * SyncProgressBar Component
 * 
 * Displays a progress bar at the top of the stats pages during synchronization.
 * Designed to be easily customizable by future AI models.
 * 
 * @param guildId - The Discord guild ID to monitor sync status for
 * @param onSyncComplete - Optional callback when sync finishes
 */

interface SyncProgressBarProps {
    guildId: string;
    onSyncComplete?: () => void;
}

interface SyncStatus {
    isRunning: boolean;
    progress: number;
    message: string;
}

export function SyncProgressBar({ guildId, onSyncComplete }: SyncProgressBarProps) {
    const [status, setStatus] = useState<SyncStatus>({
        isRunning: false,
        progress: 0,
        message: 'Ready'
    });
    const [visible, setVisible] = useState(false);
    const wasRunningRef = useRef(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const pollStatus = useCallback(async () => {
        // Guard against undefined guildId
        if (!guildId || guildId === 'undefined') {
            console.warn('[SyncProgress] No guildId, skipping poll');
            return;
        }

        try {
            // Prevent Next.js from caching GET requests containing the sync status
            const response = await fetch(`/api/guilds/${guildId}/stats/sync/status?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
            });
            const data: SyncStatus = await response.json();

            setStatus(data);

            // Show when running
            if (data.isRunning) {
                setVisible(true);
                wasRunningRef.current = true;
            }

            // If just finished (or failed/stopped), keep visible briefly then hide
            if (wasRunningRef.current && !data.isRunning) {
                wasRunningRef.current = false;
                if (data.progress === 100 && onSyncComplete) onSyncComplete();

                // Auto-hide after 1 second
                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = setTimeout(() => {
                    setVisible(false);
                }, 1000);
            }
        } catch (error) {
            console.error('[SyncProgress] Failed to fetch status:', error);
        }
    }, [guildId, onSyncComplete]);

    useEffect(() => {
        if (!guildId || guildId === 'undefined') return;

        // Auto-sync logic
        const checkAndSync = async () => {
            try {
                // Also prevent caching on the initial check
                const statusRes = await fetch(`/api/guilds/${guildId}/stats/sync/status?t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
                });
                const status = await statusRes.json();

                if (status.isRunning) return;

                // Check lastSyncDate
                const shouldSync = !status.lastSyncDate ||
                    (new Date().getTime() - new Date(status.lastSyncDate).getTime()) > 3600000;

                if (shouldSync) {
                    console.log('[SyncProgress] Triggering auto-sync (3 months)');
                    fetch(`/api/guilds/${guildId}/stats/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ days: 90 })
                    });
                }
            } catch (error) {
                console.error('[SyncProgress] Auto-sync check failed:', error);
            }
        };

        // Run auto-sync check ONLY ONCE on mount
        if (!wasRunningRef.current) {
            checkAndSync();
        }

        // Initial poll
        pollStatus();

        // Start polling every 1.5 seconds
        const intervalId = setInterval(pollStatus, 1500);

        return () => {
            clearInterval(intervalId);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [pollStatus, guildId]);

    // Don't render if not visible
    if (!visible) {
        return null;
    }

    return (
        <Card
            className="fixed top-20 left-0 right-0 z-50 mx-auto max-w-2xl bg-[#18181b]/95 backdrop-blur-xl border border-white/10 shadow-2xl"
        >
            <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                    {/* Icon based on state */}
                    {status.isRunning && (
                        <SpinnerGap size={24} weight="bold" className="text-primary animate-spin" />
                    )}
                    {!status.isRunning && status.progress === 100 && (
                        <CheckCircle size={24} weight="fill" className="text-emerald-500" />
                    )}
                    {!status.isRunning && status.progress < 100 && status.progress > 0 && (
                        <WarningCircle size={24} weight="fill" className="text-amber-500" />
                    )}

                    {/* Status text */}
                    <div className="flex-1">
                        <p className="text-sm font-bold text-white mb-0.5">
                            {status.isRunning ? 'Syncing Statistics' : 'Sync Complete'}
                        </p>
                        <p className="text-xs text-default-400 font-medium">
                            {status.message}
                        </p>
                    </div>

                    {/* Progress percentage */}
                    <div className="text-2xl font-black text-white/80">
                        {status.progress}%
                    </div>
                </div>

                {/* Progress bar */}
                <Progress
                    value={status.progress}
                    size="sm"
                    radius="sm"
                    classNames={{
                        indicator: status.isRunning
                            ? "bg-gradient-to-r from-primary to-secondary"
                            : "bg-gradient-to-r from-emerald-500 to-teal-500",
                        track: "bg-white/5"
                    }}
                    className="transition-all duration-300"
                />
            </div>
        </Card>
    );
}
