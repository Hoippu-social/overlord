'use client';

import React from 'react';
import { Card, CardBody, Button, Slider, Input, Image, ScrollShadow, Tab, Tabs } from "@nextui-org/react";
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

export const MusicWidget = () => {
    // TODO: Implement WebSocket connection to sync with bot in real-time
    // Per spec section 4: Music Console requires WebSocket for live playback sync
    // - Connect to bot's WebSocket server
    // - Receive: current track, queue, playback state, position
    // - Send: play/pause, skip, seek, volume, queue changes

    return (
        <Card className="w-full bg-surface border border-divider h-full min-h-[400px]">
            <CardBody className="p-0 flex flex-col md:flex-row h-full">
                {/* Left: Player Controls */}
                <div className="flex-1 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-divider">
                    {/* Now Playing Info */}
                    <div className="flex flex-col items-center text-center space-y-4 mt-4">
                        <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-2xl">
                            <Image
                                src="https://via.placeholder.com/300"
                                alt="Album Art"
                                classNames={{ wrapper: "w-full h-full", img: "w-full h-full object-cover" }}
                            />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">Nothing Playing</h3>
                            <p className="text-default-500">Join a voice channel to start</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full space-y-2 mt-6">
                        <Slider
                            size="sm"
                            color="primary"
                            defaultValue={0}
                            className="max-w-md mx-auto"
                            aria-label="Progress"
                        />
                        <div className="flex justify-between text-xs text-default-400 max-w-md mx-auto px-1">
                            <span>0:00</span>
                            <span>0:00</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col items-center gap-4 mt-4">
                        <div className="flex items-center gap-4">
                            <Button isIconOnly variant="light" radius="full" className="text-default-400 hover:text-foreground">
                                <Shuffle size={20} />
                            </Button>
                            <Button isIconOnly variant="light" radius="full">
                                <SkipBack size={24} weight="fill" />
                            </Button>
                            <Button isIconOnly className="w-14 h-14 bg-primary text-white shadow-lg shadow-primary/20" radius="full">
                                <Play size={28} weight="fill" />
                            </Button>
                            <Button isIconOnly variant="light" radius="full">
                                <SkipForward size={24} weight="fill" />
                            </Button>
                            <Button isIconOnly variant="light" radius="full" className="text-default-400 hover:text-foreground">
                                <Repeat size={20} />
                            </Button>
                        </div>

                        <div className="flex items-center gap-2 w-full max-w-[200px]">
                            <SpeakerHigh size={18} className="text-default-400" />
                            <Slider
                                size="sm"
                                color="foreground"
                                defaultValue={50}
                                className="max-w-full"
                                aria-label="Volume"
                            />
                        </div>
                    </div>
                </div>

                {/* Right: Queue & Search */}
                <div className="flex-1 flex flex-col bg-surface/50">
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
                            <div className="flex flex-col h-full p-4">
                                <ScrollShadow className="flex-1 h-[300px]">
                                    <div className="flex flex-col items-center justify-center h-full text-default-400 space-y-2">
                                        <MusicNote size={32} />
                                        <p>Queue is empty</p>
                                    </div>
                                </ScrollShadow>
                            </div>
                        </Tab>
                        <Tab key="search" title={
                            <div className="flex items-center gap-2">
                                <MagnifyingGlass size={18} />
                                <span>Search</span>
                            </div>
                        }>
                            <div className="p-4 space-y-4">
                                <Input
                                    placeholder="Search for songs..."
                                    startContent={<MagnifyingGlass size={18} className="text-default-400" />}
                                    variant="bordered"
                                    radius="lg"
                                    classNames={{
                                        inputWrapper: "bg-surface hover:bg-surface-hover transition-colors border-divider group-data-[focus=true]:border-primary"
                                    }}
                                />
                                <div className="text-center text-default-400 text-sm mt-8">
                                    Type to search on YouTube, Spotify, or SoundCloud
                                </div>
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </CardBody>
        </Card>
    );
};
