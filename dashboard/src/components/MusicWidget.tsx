'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Card,
    CardBody,
    Button,
    Slider,
    Input,
    Image,
    ScrollShadow,
    Tab,
    Tabs,
    Chip,
    Spinner
} from "@nextui-org/react";
import {
    Play,
    Pause,
    SkipForward,
    SkipBack,
    Shuffle,
    Repeat,
    SpeakerHigh,
    MagnifyingGlass,
    List,
    MusicNote
} from "@phosphor-icons/react";

type NowPlaying = {
    title: string;
    author?: string | null;
    uri?: string | null;
    artworkUrl?: string | null;
    durationMs?: number | null;
    positionMs?: number | null;
    volume?: number | null;
    paused?: boolean | null;
    sourceName?: string | null;
};

type SearchPlatform = 'youtube' | 'spotify' | 'soundcloud';

type SearchResult = {
    encoded: string;
    title: string;
    author?: string | null;
    uri?: string | null;
    artworkUrl?: string | null;
    durationMs?: number | null;
    sourceName?: string | null;
};

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

export const MusicWidget = ({ className = "", nowPlaying, guildId }: { className?: string; nowPlaying?: NowPlaying; guildId: string }) => {
    const [searchPlatform, setSearchPlatform] = useState<SearchPlatform>('youtube');
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
    const [queueState, setQueueState] = useState<QueueState>({ current: null, tracks: [] });
    const [queueLoading, setQueueLoading] = useState(false);
    const [queueError, setQueueError] = useState<string | null>(null);
    const [queueActionKey, setQueueActionKey] = useState<string | null>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [queueAddStatus, setQueueAddStatus] = useState<Record<string, 'added' | 'failed'>>({});
    const [localVolume, setLocalVolume] = useState<number>(nowPlaying?.volume ?? 50);
    const [pausing, setPausing] = useState(false);

    const duration = nowPlaying?.durationMs ?? 0;
    const position = nowPlaying?.positionMs ?? 0;
    const progressPercent = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;

    const formatTime = useCallback((ms: number) => {
        const safeMs = Number.isFinite(ms) ? ms : 0;
        const totalSeconds = Math.floor(safeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    const platformLabel = useMemo(() => {
        switch (searchPlatform) {
            case 'spotify': return 'Spotify';
            case 'soundcloud': return 'SoundCloud';
            default: return 'YouTube';
        }
    }, [searchPlatform]);

    const fetchQueue = useCallback(async () => {
        if (!guildId) return;
        setQueueLoading(true);
        setQueueError(null);
        try {
            const res = await fetch(`/api/guilds/${guildId}/music/queue`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Failed to load queue.');
            }
            if (data?.queue) {
                setQueueState({
                    current: data.queue.current || null,
                    tracks: data.queue.tracks || [],
                    paused: data.queue.paused ?? null,
                    volume: data.queue.volume ?? null,
                    positionMs: data.queue.positionMs ?? null,
                    repeatMode: data.queue.repeatMode ?? null,
                });
            } else {
                setQueueState({ current: null, tracks: [] });
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to load queue.';
            setQueueError(message);
        } finally {
            setQueueLoading(false);
        }
    }, [guildId]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchError('Enter a query to search.');
            setSearchResults([]);
            return;
        }
        setSearching(true);
        setSearchError(null);
        setQueueAddStatus({});
        try {
            const res = await fetch(`/api/guilds/${guildId}/music/search?platform=${searchPlatform}&query=${encodeURIComponent(searchQuery.trim())}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Failed to search Lavalink.');
            }
            setSearchResults(data.tracks || []);
            if (!data.tracks || data.tracks.length === 0) {
                setSearchError(`Nothing found on ${platformLabel}.`);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to search.';
            setSearchError(message);
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const runQueueAction = async (payload: Record<string, unknown>, actionKey: string) => {
        setQueueActionKey(actionKey);
        setQueueError(null);
        try {
            const res = await fetch(`/api/guilds/${guildId}/music/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Failed to update queue.');
            }
            if (data?.queue) {
                setQueueState({
                    current: data.queue.current || null,
                    tracks: data.queue.tracks || [],
                    paused: data.queue.paused ?? null,
                    volume: data.queue.volume ?? null,
                    positionMs: data.queue.positionMs ?? null,
                    repeatMode: data.queue.repeatMode ?? null,
                });
            } else {
                await fetchQueue();
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update queue.';
            setQueueError(message);
        } finally {
            setQueueActionKey(null);
        }
    };

    const sendControl = async (payload: { paused?: boolean; volume?: number; positionMs?: number }) => {
        const res = await fetch(`/api/guilds/${guildId}/music/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || 'Failed to update player.');
        }
    };

    const handleTogglePause = async () => {
        if (!nowPlaying) return;
        setPausing(true);
        try {
            await sendControl({ paused: !nowPlaying.paused });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to toggle playback.';
            setSearchError(message);
        } finally {
            setPausing(false);
        }
    };

    const handleVolumeChange = async (value: number | number[]) => {
        const vol = Array.isArray(value) ? value[0] : value;
        setLocalVolume(vol);
    };

    const handleVolumeCommit = async (value: number | number[]) => {
        const vol = Array.isArray(value) ? value[0] : value;
        try {
            await sendControl({ volume: vol });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to set volume.';
            setSearchError(message);
        }
    };

    const handleSeek = async (percent: number | number[]) => {
        if (!nowPlaying?.durationMs) return;
        const val = Array.isArray(percent) ? percent[0] : percent;
        const clamped = Math.max(0, Math.min(100, val));
        const targetMs = Math.round((clamped / 100) * nowPlaying.durationMs);
        try {
            await sendControl({ positionMs: targetMs });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to seek.';
            setSearchError(message);
        }
    };

    const handleQueueTrack = async (track: SearchResult) => {
        if (!track?.encoded) return;
        setAddingTrackId(track.encoded);
        setQueueError(null);
        try {
            const res = await fetch(`/api/guilds/${guildId}/music/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encodedTrack: track.encoded }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Failed to add track to queue.');
            }
            setQueueAddStatus((prev) => ({ ...prev, [track.encoded]: 'added' }));
            await fetchQueue();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to add track.';
            setQueueError(message);
            if (track.encoded) {
                setQueueAddStatus((prev) => ({ ...prev, [track.encoded]: 'failed' }));
            }
        } finally {
            setAddingTrackId(null);
        }
    };

    const title = nowPlaying?.title || 'Nothing Playing';
    const subtitle = nowPlaying ? (nowPlaying.author || nowPlaying.uri || '') : 'Join a voice channel to start';
    const artwork = nowPlaying?.artworkUrl || 'https://via.placeholder.com/300';
    const isPaused = !!nowPlaying?.paused;

    // Sync local volume with incoming nowPlaying
    useEffect(() => {
        if (typeof nowPlaying?.volume === 'number') {
            setLocalVolume(nowPlaying.volume);
        }
    }, [nowPlaying?.volume]);

    useEffect(() => {
        fetchQueue();
        const timer = setInterval(fetchQueue, 5000);
        return () => clearInterval(timer);
    }, [fetchQueue]);

    const queueTracks = queueState.tracks || [];
    const queueCount = queueTracks.length;
    const hasQueue = queueCount > 0;

    return (
        <Card className={`w-full bg-surface border border-divider h-full min-h-[400px] overflow-hidden ${className}`}>
            <CardBody className="p-0 flex flex-col md:flex-row h-full overflow-hidden">
                {/* Left: Player Controls */}
                <div className="flex-1 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-divider min-w-0">
                    {/* Now Playing Info */}
                    <div className="flex flex-col items-center text-center space-y-4 mt-4">
                        <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-2xl">
                            <Image
                                src={artwork}
                                alt="Album Art"
                                classNames={{ wrapper: "w-full h-full", img: "w-full h-full object-cover" }}
                            />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground line-clamp-1">{title}</h3>
                            <p className="text-default-500 line-clamp-1">{subtitle}</p>
                            {nowPlaying && (
                                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-default-400">
                                    <Chip size="sm" variant="flat" color={nowPlaying.paused ? "warning" : "success"}>
                                        {nowPlaying.paused ? 'Paused' : 'Playing'}
                                    </Chip>
                                    {typeof nowPlaying.volume === 'number' && (
                                        <Chip size="sm" variant="flat" color="secondary">
                                            Vol {nowPlaying.volume}%
                                        </Chip>
                                    )}
                                    {nowPlaying.sourceName && (
                                        <Chip size="sm" variant="flat">
                                            {nowPlaying.sourceName}
                                        </Chip>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full space-y-2 mt-6">
                        <Slider
                            size="sm"
                            color="primary"
                            value={progressPercent}
                            maxValue={100}
                            minValue={0}
                            isDisabled={!nowPlaying?.durationMs}
                            className="max-w-md mx-auto"
                            aria-label="Progress"
                            onChangeEnd={handleSeek}
                        />
                        <div className="flex justify-between text-xs text-default-400 max-w-md mx-auto px-1">
                            <span>{formatTime(position)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col items-center gap-4 mt-4">
                        <div className="flex items-center gap-4">
                            <Button isIconOnly variant="light" radius="full" className="text-default-400 hover:text-foreground" isDisabled>
                                <Shuffle size={20} />
                            </Button>
                            <Button isIconOnly variant="light" radius="full" isDisabled>
                                <SkipBack size={24} weight="fill" />
                            </Button>
                            <Button
                                isIconOnly
                                className="w-14 h-14 bg-primary text-white shadow-lg shadow-primary/20"
                                radius="full"
                                onPress={handleTogglePause}
                                isDisabled={!nowPlaying}
                                isLoading={pausing}
                            >
                                {isPaused ? <Play size={28} weight="fill" /> : <Pause size={28} weight="fill" />}
                            </Button>
                            <Button isIconOnly variant="light" radius="full" isDisabled>
                                <SkipForward size={24} weight="fill" />
                            </Button>
                            <Button isIconOnly variant="light" radius="full" className="text-default-400 hover:text-foreground" isDisabled>
                                <Repeat size={20} />
                            </Button>
                        </div>

                        <div className="flex items-center gap-2 w-full max-w-[220px]">
                            <SpeakerHigh size={18} className="text-default-400" />
                            <Slider
                                size="sm"
                                color="foreground"
                                value={localVolume}
                                maxValue={150}
                                minValue={0}
                                isDisabled={!nowPlaying}
                                className="max-w-full"
                                aria-label="Volume"
                                onChange={handleVolumeChange}
                                onChangeEnd={handleVolumeCommit}
                                step={1}
                            />
                        </div>
                    </div>
                </div>

                {/* Right: Queue & Search */}
                <div className="flex-1 flex flex-col bg-surface/50 min-w-0">
                    <Tabs
                        aria-label="Music Options"
                        variant="underlined"
                        classNames={{
                            tabList: "w-full border-b border-divider p-0 gap-0",
                            cursor: "w-full bg-primary",
                            tab: "h-12 px-0",
                            tabContent: "group-data-[selected=true]:text-primary font-semibold"
                        }}
                    >
                        <Tab key="queue" title={
                            <div className="flex items-center gap-2">
                                <List size={18} />
                                <span>Queue</span>
                            </div>
                        }>
                            <div className="flex flex-col h-full p-4 min-h-[340px]">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                    <div className="min-w-0">
                                        <p className="text-xs uppercase tracking-wide text-default-400">Queue</p>
                                        <p className="text-sm font-semibold">{queueCount} tracks</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        <Button size="sm" variant="flat" onPress={fetchQueue} isLoading={queueLoading}>
                                            Refresh
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            onPress={() => runQueueAction({ action: 'shuffle' }, 'shuffle')}
                                            isDisabled={!hasQueue}
                                            isLoading={queueActionKey === 'shuffle'}
                                        >
                                            Shuffle
                                        </Button>
                                        <Button
                                            size="sm"
                                            color="danger"
                                            variant="flat"
                                            onPress={() => runQueueAction({ action: 'clear' }, 'clear')}
                                            isDisabled={!hasQueue}
                                            isLoading={queueActionKey === 'clear'}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>

                                {queueError && (
                                    <div className="text-danger text-sm mb-2">{queueError}</div>
                                )}

                                {queueState.current && (
                                    <div className="flex items-center gap-3 p-3 rounded-lg border border-divider bg-default-50 mb-3">
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-default-100 flex-shrink-0">
                                            <Image
                                                src={queueState.current.artworkUrl || artwork}
                                                alt={queueState.current.title}
                                                radius="none"
                                                classNames={{ img: "w-full h-full object-cover", wrapper: "w-full h-full" }}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs uppercase tracking-wide text-default-400">Now playing</p>
                                            <p className="font-semibold text-foreground truncate">{queueState.current.title}</p>
                                            <p className="text-default-500 text-sm truncate">{queueState.current.author || queueState.current.uri || 'Unknown artist'}</p>
                                        </div>
                                    </div>
                                )}

                                <ScrollShadow className="flex-1 h-[260px] overflow-x-hidden">
                                    {queueLoading && queueCount === 0 && !queueState.current ? (
                                        <div className="flex items-center justify-center h-full text-default-400">
                                            <Spinner size="sm" color="primary" />
                                        </div>
                                    ) : queueCount > 0 ? (
                                        <div className="space-y-3">
                                            {queueTracks.map((track, index) => (
                                                <div
                                                    key={`${track.encoded || 'track'}-${index}`}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border border-divider bg-default-50 w-full ${dragOverIndex === index ? 'ring-2 ring-primary/40' : ''} ${draggingIndex === index ? 'opacity-60' : ''}`}
                                                    onDragOver={(event) => {
                                                        event.preventDefault();
                                                        event.dataTransfer.dropEffect = 'move';
                                                        if (dragOverIndex !== index) setDragOverIndex(index);
                                                    }}
                                                    onDragLeave={() => {
                                                        if (dragOverIndex === index) setDragOverIndex(null);
                                                    }}
                                                    onDrop={async (event) => {
                                                        event.preventDefault();
                                                        const raw = event.dataTransfer.getData('text/plain');
                                                        const from = draggingIndex ?? Number.parseInt(raw, 10);
                                                        if (!Number.isInteger(from) || from === index) {
                                                            setDraggingIndex(null);
                                                            setDragOverIndex(null);
                                                            return;
                                                        }
                                                        await runQueueAction({ action: 'move', from, to: index }, `move-${from}-${index}`);
                                                        setDraggingIndex(null);
                                                        setDragOverIndex(null);
                                                    }}
                                                >
                                                    <div
                                                        className="text-xs text-default-400 w-6 text-center cursor-grab active:cursor-grabbing select-none"
                                                        draggable
                                                        onDragStart={(event) => {
                                                            setDraggingIndex(index);
                                                            event.dataTransfer.effectAllowed = 'move';
                                                            event.dataTransfer.setData('text/plain', String(index));
                                                        }}
                                                        onDragEnd={() => {
                                                            setDraggingIndex(null);
                                                            setDragOverIndex(null);
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </div>
                                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-default-100 flex-shrink-0">
                                                        <Image
                                                            src={track.artworkUrl || artwork}
                                                            alt={track.title}
                                                            radius="none"
                                                            classNames={{ img: "w-full h-full object-cover", wrapper: "w-full h-full" }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-foreground truncate">{track.title}</p>
                                                        <p className="text-default-500 text-sm truncate">{track.author || track.uri || 'Unknown artist'}</p>
                                                        <div className="flex items-center gap-2 text-xs text-default-400 mt-1">
                                                            <span>{formatTime(track.durationMs ?? 0)}</span>
                                                            {track.sourceName && (
                                                                <Chip size="sm" variant="flat" color="secondary" className="capitalize">
                                                                    {track.sourceName}
                                                                </Chip>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            color="danger"
                                                            variant="light"
                                                            onPress={() => runQueueAction({ action: 'remove', index }, `remove-${index}`)}
                                                            isLoading={queueActionKey === `remove-${index}`}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {draggingIndex !== null && (
                                                <div
                                                    className={`flex items-center justify-center p-3 rounded-lg border border-dashed border-divider text-xs text-default-400 ${dragOverIndex === queueCount ? 'ring-2 ring-primary/40' : ''}`}
                                                    onDragOver={(event) => {
                                                        event.preventDefault();
                                                        event.dataTransfer.dropEffect = 'move';
                                                        if (dragOverIndex !== queueCount) setDragOverIndex(queueCount);
                                                    }}
                                                    onDragLeave={() => {
                                                        if (dragOverIndex === queueCount) setDragOverIndex(null);
                                                    }}
                                                    onDrop={async (event) => {
                                                        event.preventDefault();
                                                        const raw = event.dataTransfer.getData('text/plain');
                                                        const from = draggingIndex ?? Number.parseInt(raw, 10);
                                                        if (!Number.isInteger(from)) {
                                                            setDraggingIndex(null);
                                                            setDragOverIndex(null);
                                                            return;
                                                        }
                                                        await runQueueAction({ action: 'move', from, to: queueCount }, `move-${from}-end`);
                                                        setDraggingIndex(null);
                                                        setDragOverIndex(null);
                                                    }}
                                                >
                                                    Drop here to move to end
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-default-400 space-y-2">
                                            <MusicNote size={32} />
                                            <p>Queue is empty</p>
                                        </div>
                                    )}
                                </ScrollShadow>
                            </div>
                        </Tab>
                        <Tab key="search" title={
                            <div className="flex items-center gap-2">
                                <MagnifyingGlass size={18} />
                                <span>Search</span>
                            </div>
                        }>
                            <div className="p-4 space-y-4 min-h-[340px]">
                                <Input
                                    placeholder={`Search on ${platformLabel}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSearch();
                                    }}
                                    startContent={<MagnifyingGlass size={18} className="text-default-400" />}
                                    endContent={
                                        <Button size="sm" color="primary" isLoading={searching} onPress={handleSearch}>
                                            Find
                                        </Button>
                                    }
                                    variant="bordered"
                                    radius="lg"
                                    classNames={{
                                        inputWrapper: "bg-surface hover:bg-surface-hover transition-colors border-divider group-data-[focus=true]:border-primary"
                                    }}
                                />

                                <div className="flex flex-wrap gap-2">
                                    {([
                                        { key: 'youtube', label: 'YouTube' },
                                        { key: 'spotify', label: 'Spotify' },
                                        { key: 'soundcloud', label: 'SoundCloud' },
                                    ] as { key: SearchPlatform; label: string }[]).map((item) => {
                                        const selected = searchPlatform === item.key;
                                        return (
                                            <Button
                                                key={item.key}
                                                size="sm"
                                                variant={selected ? 'solid' : 'flat'}
                                                color={selected ? 'primary' : 'default'}
                                                onPress={() => setSearchPlatform(item.key)}
                                            >
                                                {item.label}
                                            </Button>
                                        );
                                    })}
                                </div>

                                {searchError && (
                                    <div className="text-danger text-sm">{searchError}</div>
                                )}

                                <ScrollShadow className="flex-1 h-[260px] overflow-x-hidden">
                                    {searching ? (
                                        <div className="flex items-center justify-center h-full text-default-400">
                                            <Spinner size="sm" color="primary" />
                                        </div>
                                    ) : searchResults.length > 0 ? (
                                        <div className="space-y-3">
                                            {searchResults.map((track, idx) => (
                                                <div
                                                    key={`${track.encoded}-${idx}`}
                                                    className="flex items-center gap-3 p-3 rounded-lg border border-divider bg-default-50 w-full"
                                                >
                                                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-default-100 flex-shrink-0">
                                                        <Image
                                                            src={track.artworkUrl || artwork}
                                                            alt={track.title}
                                                            radius="none"
                                                            classNames={{ img: "w-full h-full object-cover", wrapper: "w-full h-full" }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-foreground truncate">{track.title}</p>
                                                        <p className="text-default-500 text-sm truncate">{track.author || track.uri || 'Unknown artist'}</p>
                                                        <div className="flex items-center gap-2 text-xs text-default-400 mt-1">
                                                            <span>{formatTime(track.durationMs ?? 0)}</span>
                                                            {track.sourceName && (
                                                                <Chip size="sm" variant="flat" color="secondary" className="capitalize">
                                                                    {track.sourceName}
                                                                </Chip>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2 items-end">
                                                        {track.encoded && queueAddStatus[track.encoded] === 'added' ? (
                                                            <Button size="sm" color="success" variant="flat" isDisabled>
                                                                Added
                                                            </Button>
                                                        ) : track.encoded && queueAddStatus[track.encoded] === 'failed' ? (
                                                            <Button size="sm" color="danger" variant="flat" isDisabled>
                                                                Failed
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                color="primary"
                                                                variant="solid"
                                                                isLoading={addingTrackId === track.encoded}
                                                                onPress={() => handleQueueTrack(track)}
                                                            >
                                                                Add to queue
                                                            </Button>
                                                        )}
                                                        <Button
                                                            as="a"
                                                            href={track.uri || '#'}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            size="sm"
                                                            variant="light"
                                                            isDisabled={!track.uri}
                                                        >
                                                            Open
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-default-400 text-sm mt-8">
                                            Type a query to search on YouTube, Spotify, or SoundCloud
                                        </div>
                                    )}
                                </ScrollShadow>
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </CardBody>
        </Card>
    );
};
