'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    MusicNotesSimple, Play, Pause, SkipForward, SkipBack,
    SpeakerHigh, SpeakerLow, SpeakerNone, ListPlus, List, Trash, DotsSixVertical, MagnifyingGlass, Plus
} from '@phosphor-icons/react';

type QueueTrack = {
    encoded?: string;
    title: string;
    author?: string | null;
    uri?: string | null;
    artworkUrl?: string | null;
    durationMs?: number | null;
    sourceName?: string | null;
};

type QueueState = {
    current: QueueTrack | null;
    tracks: QueueTrack[];
    paused?: boolean | null;
    volume?: number | null;
    positionMs?: number | null;
    repeatMode?: string | null;
};

export function DashboardAudioPlayer({ guildId }: { guildId: string }) {
    const [queueState, setQueueState] = useState<QueueState>({ current: null, tracks: [] });
    const [loading, setLoading] = useState(true);
    const [localVolume, setLocalVolume] = useState(50);
    const [localProgress, setLocalProgress] = useState(0);
    const [isDraggingProgress, setIsDraggingProgress] = useState(false);
    const [showQueue, setShowQueue] = useState(false);

    // Search State
    const [activeTab, setActiveTab] = useState<'queue' | 'search'>('queue');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchPlatform, setSearchPlatform] = useState<'youtube' | 'spotify' | 'soundcloud'>('youtube');
    const [addingTrackId, setAddingTrackId] = useState<string | null>(null);

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch(`/api/guilds/${guildId}/music/queue`);
            const data = await res.json();
            if (data?.queue) {
                setQueueState({
                    current: data.queue.current || null,
                    tracks: data.queue.tracks || [],
                    paused: data.queue.paused ?? null,
                    volume: data.queue.volume ?? null,
                    positionMs: data.queue.positionMs ?? null,
                    repeatMode: data.queue.repeatMode ?? null,
                });
                if (!isDraggingProgress && typeof data.queue.positionMs === 'number') {
                    setLocalProgress(data.queue.positionMs);
                }
                if (typeof data.queue.volume === 'number') {
                    setLocalVolume(data.queue.volume);
                }
            } else {
                setQueueState({ current: null, tracks: [] });
            }
        } catch (error) {
            console.error('Failed to fetch queue', error);
        } finally {
            setLoading(false);
        }
    }, [guildId, isDraggingProgress]);

    useEffect(() => {
        fetchQueue();
        const timer = setInterval(fetchQueue, 3000);
        return () => clearInterval(timer);
    }, [fetchQueue]);

    // Optimistic progress timer
    useEffect(() => {
        if (!queueState.paused && queueState.current && !isDraggingProgress) {
            const interval = setInterval(() => {
                setLocalProgress(p => {
                    const duration = queueState.current?.durationMs || 0;
                    if (p >= duration && duration > 0) return duration;
                    return p + 1000;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [queueState.paused, queueState.current, isDraggingProgress]);

    const sendControl = async (payload: { paused?: boolean; volume?: number; positionMs?: number }) => {
        try {
            await fetch(`/api/guilds/${guildId}/music/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            fetchQueue();
        } catch (error) {
            console.error('Failed to control player', error);
        }
    };

    const runQueueAction = async (payload: any) => {
        try {
            await fetch(`/api/guilds/${guildId}/music/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            fetchQueue();
        } catch (error) {
            console.error('Failed to run queue action', error);
        }
    };

    const handlePlayPause = () => {
        const nextState = !queueState.paused;
        setQueueState(prev => ({ ...prev, paused: nextState }));
        sendControl({ paused: nextState });
    };

    const handleSkip = () => {
        runQueueAction({ action: 'skip' });
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setLocalVolume(val);
    };

    const handleVolumeCommit = (e: React.MouseEvent | React.TouchEvent) => {
        sendControl({ volume: localVolume });
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalProgress(Number(e.target.value));
    };

    const handleProgressCommit = () => {
        setIsDraggingProgress(false);
        sendControl({ positionMs: localProgress });
    };

    const handleRemoveTrack = (index: number) => {
        runQueueAction({ action: 'remove', index });
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/music/search?platform=${searchPlatform}&query=${encodeURIComponent(searchQuery.trim())}`);
            const data = await res.json();
            setSearchResults(data.tracks || []);
        } catch (error) {
            console.error('Failed to search', error);
        } finally {
            setSearching(false);
        }
    };

    const handleAddTrack = async (track: any) => {
        if (!track?.encoded) return;
        setAddingTrackId(track.encoded);
        try {
            await fetch(`/api/guilds/${guildId}/music/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encodedTrack: track.encoded }),
            });
            await fetchQueue();
        } catch (error) {
            console.error('Failed to add track', error);
        } finally {
            setAddingTrackId(null);
        }
    };

    const currentTrack = queueState.current;
    const duration = currentTrack?.durationMs || 0;
    const progressPercent = duration > 0 ? (localProgress / duration) * 100 : 0;

    const formatTime = (ms: number) => {
        if (!Number.isFinite(ms) || ms < 0) return '0:00';
        const totalSecs = Math.floor(ms / 1000);
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const VolumeIcon = localVolume === 0 ? SpeakerNone : localVolume < 50 ? SpeakerLow : SpeakerHigh;

    return (
        <div className="bg-[var(--surface-card)] rounded-[24px] border border-[var(--border-subtle)] flex flex-col relative overflow-hidden group min-h-[160px] shadow-sm">
            {/* Background Glow */}
            <div className={`absolute -top-12 -right-12 w-32 h-32 ${currentTrack && !queueState.paused ? 'bg-[var(--color-primary-1)]/20 animate-pulse' : 'bg-[var(--color-primary-1)]/10'} rounded-full blur-3xl transition-colors pointer-events-none`}></div>

            <div className="p-6 flex flex-col z-10 gap-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        {currentTrack?.artworkUrl ? (
                            <img src={currentTrack.artworkUrl} alt={currentTrack.title} className="w-16 h-16 rounded-[14px] object-cover ring-1 ring-[var(--border-divider)] shadow-sm" />
                        ) : (
                            <div className="w-16 h-16 rounded-[14px] bg-[var(--surface-hover)] border border-[var(--border-divider)] flex items-center justify-center shrink-0 shadow-sm text-[var(--text-muted)]">
                                <MusicNotesSimple size={28} weight="duotone" />
                            </div>
                        )}
                        <div className="min-w-0 flex flex-col">
                            <h3 className="text-base font-bold text-white leading-tight truncate">
                                {currentTrack ? currentTrack.title : 'Not Playing'}
                            </h3>
                            <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                                {currentTrack ? (currentTrack.author || 'Unknown Artist') : 'Queue is empty'}
                            </p>
                            {currentTrack && (
                                <div className="flex items-center gap-2 text-[10px] text-[var(--color-primary-1)] font-bold mt-1.5 opacity-90">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-1)] animate-pulse"></span>
                                    {queueState.paused ? 'PAUSED' : 'NOW PLAYING'}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => setShowQueue(!showQueue)}
                        className={`p-2 rounded-xl border transition-colors ${showQueue ? 'bg-[var(--surface-hover)] border-[var(--border-divider)] text-white' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-white'}`}
                        title="Toggle Queue"
                    >
                        <List size={22} weight="duotone" />
                    </button>
                </div>

                <div className="flex flex-col gap-3 mt-auto pt-2">
                    {/* Progress Bar & Timers */}
                    <div className="flex flex-col gap-1.5 group/slider">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] tabular-nums font-mono text-[var(--text-secondary)] w-8 text-right">
                                {formatTime(localProgress)}
                            </span>
                            <div className="relative flex-1 h-3 flex items-center">
                                <input
                                    type="range"
                                    min={0}
                                    max={duration || 100}
                                    value={localProgress}
                                    onChange={handleProgressChange}
                                    onMouseDown={() => setIsDraggingProgress(true)}
                                    onTouchStart={() => setIsDraggingProgress(true)}
                                    onMouseUp={handleProgressCommit}
                                    onTouchEnd={handleProgressCommit}
                                    disabled={!currentTrack}
                                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="absolute inset-x-0 h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-[var(--color-primary-1)] rounded-full transition-all"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                {/* Thumb */}
                                <div
                                    className="absolute h-3 w-3 rounded-full bg-white shadow-sm opacity-0 group-hover/slider:opacity-100 transition-opacity -ml-1.5 pointer-events-none"
                                    style={{ left: `${progressPercent}%` }}
                                />
                            </div>
                            <span className="text-[10px] tabular-nums font-mono text-[var(--text-secondary)] w-8">
                                {formatTime(duration)}
                            </span>
                        </div>
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-between">
                        {/* Empty spacer for flex alignment */}
                        <div className="hidden sm:flex items-center gap-2 w-28"></div>

                        {/* Main Buttons */}
                        <div className="flex items-center justify-center gap-4 pr-12 sm:pr-0">
                            <button className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-[var(--text-secondary)]" disabled={!currentTrack}>
                                <SkipBack size={20} weight="fill" />
                            </button>
                            <button
                                onClick={handlePlayPause}
                                disabled={!currentTrack}
                                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {queueState.paused ? <Play size={22} weight="fill" className="ml-1" /> : <Pause size={22} weight="fill" />}
                            </button>
                            <button
                                onClick={handleSkip}
                                disabled={!currentTrack}
                                className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-[var(--text-secondary)]"
                            >
                                <SkipForward size={20} weight="fill" />
                            </button>
                        </div>

                        {/* Volume Control */}
                        <div className="flex items-center gap-2 w-28 group/vol relative">
                            <VolumeIcon size={18} className="text-[var(--text-secondary)] shrink-0" weight="duotone" />
                            <div className="relative flex-1 h-3 flex items-center">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={localVolume}
                                    onChange={handleVolumeChange}
                                    onMouseUp={handleVolumeCommit}
                                    onTouchEnd={handleVolumeCommit}
                                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="absolute inset-x-0 h-1 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-[var(--text-secondary)] transition-all"
                                        style={{ width: `${localVolume}%` }}
                                    />
                                </div>
                                <div
                                    className="absolute h-2 w-2 rounded-full bg-white shadow-sm opacity-0 group-hover/vol:opacity-100 transition-opacity -ml-1 pointer-events-none"
                                    style={{ left: `${localVolume}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Queue Drawer */}
            {showQueue && (
                <div className="border-t border-[var(--border-divider)] bg-[var(--surface-card)] flex flex-col max-h-[350px] animate-fade-in relative z-20">
                    <div className="flex items-center border-b border-[var(--border-divider)] px-4 pt-3 gap-6 bg-[var(--surface-card)] shrink-0">
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'queue' ? 'border-[var(--color-primary-1)] text-white' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-muted)]'}`}
                        >
                            Up Next ({queueState.tracks.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('search')}
                            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'search' ? 'border-[var(--color-primary-1)] text-white' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-muted)]'}`}
                        >
                            Search
                        </button>
                    </div>

                    <div className="p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 min-h-[200px]">
                        {activeTab === 'queue' && (
                            <>
                                {queueState.tracks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)] text-xs h-full">
                                        <ListPlus size={24} className="mb-2 opacity-50" />
                                        <span>Queue is empty</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {queueState.tracks.map((track, i) => (
                                            <div key={`${track.encoded}-${i}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors group/item shrink-0">
                                                <div className="w-8 flex justify-center cursor-grab text-[var(--text-muted)] group-hover/item:text-white transition-colors">
                                                    <span className="text-[10px] font-mono group-hover/item:hidden">{i + 1}</span>
                                                    <DotsSixVertical size={14} className="hidden group-hover/item:block text-[var(--text-secondary)]" />
                                                </div>
                                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--surface-hover)] shrink-0">
                                                    {track.artworkUrl ? (
                                                        <img src={track.artworkUrl} alt="art" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                                                            <MusicNotesSimple size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-semibold text-white truncate">{track.title}</p>
                                                    <p className="text-[11px] text-[var(--text-muted)] truncate">{track.author}</p>
                                                </div>
                                                <div className="flex items-center gap-2 pr-2 shrink-0">
                                                    <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-0 group-hover/item:opacity-100 transition-opacity mr-2">
                                                        {formatTime(track.durationMs || 0)}
                                                    </span>
                                                    <button
                                                        onClick={() => handleRemoveTrack(i)}
                                                        className="text-[var(--text-muted)] hover:text-[var(--color-destructive)] transition-colors opacity-0 group-hover/item:opacity-100"
                                                        title="Remove Track"
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'search' && (
                            <div className="flex flex-col gap-4">
                                <form onSubmit={handleSearch} className="flex gap-2 shrink-0">
                                    <div className="relative flex-1">
                                        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                        <input
                                            type="text"
                                            placeholder={`Search on ${searchPlatform}...`}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-[var(--surface-hover)] border border-[var(--border-subtle)] focus:border-[var(--color-primary-1)] rounded-xl py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={searching || !searchQuery.trim()}
                                        className="bg-[var(--color-primary-1)] text-black px-4 rounded-xl text-sm font-bold hover:bg-[var(--color-primary-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                    >
                                        {searching ? '...' : 'Search'}
                                    </button>
                                </form>

                                <div className="flex gap-2 shrink-0">
                                    {(['youtube', 'spotify', 'soundcloud'] as const).map((platform) => (
                                        <button
                                            key={platform}
                                            onClick={() => setSearchPlatform(platform)}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors border ${searchPlatform === platform ? 'border-[var(--color-primary-1)] text-[var(--color-primary-1)] bg-[var(--color-primary-1)]/10' : 'border-[var(--border-divider)] text-[var(--text-muted)] hover:text-white'}`}
                                        >
                                            {platform}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-2 mt-2">
                                    {searchResults.length === 0 && !searching && searchQuery && (
                                        <div className="text-center py-6 text-sm text-[var(--text-muted)]">No results found.</div>
                                    )}
                                    {searchResults.map((track, i) => (
                                        <div key={`${track.encoded}-${i}`} className="flex items-center gap-3 p-2 rounded-xl border border-[var(--border-divider)] bg-[var(--surface-hover)]/30 group/item shrink-0">
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--surface-hover)] shrink-0">
                                                {track.artworkUrl ? (
                                                    <img src={track.artworkUrl} alt="art" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                                                        <MusicNotesSimple size={16} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-semibold text-white truncate">{track.title}</p>
                                                <p className="text-[11px] text-[var(--text-muted)] truncate">{track.author}</p>
                                            </div>
                                            <div className="flex items-center gap-2 pr-2 shrink-0">
                                                <span className="text-[10px] font-mono text-[var(--text-secondary)] mr-2 hidden sm:block">
                                                    {formatTime(track.durationMs || 0)}
                                                </span>
                                                <button
                                                    onClick={() => handleAddTrack(track)}
                                                    disabled={addingTrackId === track.encoded}
                                                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${addingTrackId === track.encoded ? 'bg-[var(--surface-hover)] text-white' : 'bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)] hover:bg-[var(--color-primary-1)] hover:text-black'}`}
                                                >
                                                    <Plus size={16} weight="bold" />
                                                    {addingTrackId === track.encoded && <span className="text-[10px] font-bold px-1">...</span>}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--surface-hover);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: var(--border-divider);
                }
            `}</style>
        </div>
    );
}
