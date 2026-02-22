'use client';

import React from 'react';
import { Avatar } from '@nextui-org/react';

export type APIEmbed = {
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    timestamp?: string;
    footer?: { text: string; icon_url?: string };
    image?: { url: string };
    thumbnail?: { url: string };
    video?: { url: string };
    provider?: { name?: string; url?: string };
    author?: { name: string; url?: string; icon_url?: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
};

export type MessagePayload = {
    content: string;
    embeds?: APIEmbed[];
};

interface DiscordMessagePreviewProps {
    message: MessagePayload;
    botName?: string;
    botAvatar?: string;
}

const colorIntToHex = (color?: number) => {
    if (!color) return '#202225'; // Default dark gray
    return '#' + color.toString(16).padStart(6, '0');
};

export default function DiscordMessagePreview({ message, botName = "Bot", botAvatar }: DiscordMessagePreviewProps) {
    return (
        <div className="w-full max-w-2xl bg-[#313338] font-sans text-white rounded-lg p-4 shadow-sm border border-[#2B2D31]">
            <div className="flex gap-4">
                <Avatar
                    src={botAvatar}
                    name={botName}
                    classNames={{
                        base: "bg-[#5865F2] mt-0.5 w-10 h-10 min-w-10 min-h-10",
                        name: "text-white font-medium"
                    }}
                />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium hover:underline cursor-pointer text-white">
                            {botName}
                        </span>
                        <span className="bg-[#5865F2] text-[10px] px-1.5 rounded-[3px] py-px flex items-center h-[15px] leading-none uppercase font-bold">
                            BOT
                        </span>
                        <span className="textxs text-[#949BA4] ml-1">Today at 12:00 PM</span>
                    </div>

                    {/* Message Content */}
                    {message.content && (
                        <div className="whitespace-pre-wrap text-[#DBDEE1] mb-2 leading-[1.375rem]">
                            {message.content}
                        </div>
                    )}

                    {/* Embeds */}
                    {message.embeds?.map((embed, i) => (
                        <div
                            key={i}
                            className="bg-[#2B2D31] rounded-l-md grid max-w-[520px] w-full mt-2"
                            style={{
                                borderLeft: `4px solid ${colorIntToHex(embed.color)}`,
                                gridTemplateColumns: "1fr auto"
                                // If thumbnail exists, it takes the right column.
                            }}
                        >
                            <div className="p-4 gap-2 flex flex-col min-w-0">
                                {/* Author */}
                                {embed.author && (
                                    <div className="flex items-center gap-2 mb-1">
                                        {embed.author.icon_url && (
                                            <img src={embed.author.icon_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                                        )}
                                        <span className="text-sm font-semibold text-white truncate text-[#F2F3F5]">
                                            {embed.author.name}
                                        </span>
                                    </div>
                                )}

                                {/* Title */}
                                {embed.title && (
                                    <div className={`font-semibold text-white hover:underline cursor-pointer mb-1 ${!embed.author ? 'mt-1' : ''}`}>
                                        {embed.title}
                                    </div>
                                )}

                                {/* Description */}
                                {embed.description && (
                                    <div className="text-sm text-[#DBDEE1] whitespace-pre-wrap">
                                        {embed.description}
                                    </div>
                                )}

                                {/* Fields */}
                                {embed.fields && embed.fields.length > 0 && (
                                    <div className="grid grid-cols-12 gap-2 mt-2">
                                        {embed.fields.map((field, idx) => (
                                            <div
                                                key={idx}
                                                className={`col-span-${field.inline ? '4' : '12'} min-w-0`}
                                            >
                                                <div className="text-xs font-semibold text-[#B5BAC1] mb-1 truncate">
                                                    {field.name}
                                                </div>
                                                <div className="text-sm text-[#DBDEE1] whitespace-pre-wrap">
                                                    {field.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Image */}
                                {embed.image && (
                                    <img
                                        src={embed.image.url}
                                        alt="Embed Image"
                                        className="rounded-md mt-3 max-w-full max-h-[300px] object-cover"
                                    />
                                )}

                                {/* Footer */}
                                {embed.footer && (
                                    <div className="flex items-center gap-2 mt-2 pt-2 text-xs text-[#949BA4]">
                                        {embed.footer.icon_url && (
                                            <img src={embed.footer.icon_url} alt="" className="w-5 h-5 rounded-full" />
                                        )}
                                        <span>{embed.footer.text}</span>
                                        {embed.timestamp && (
                                            <>
                                                <span className="mx-1">•</span>
                                                <span>Today at 12:00 PM</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Thumbnail */}
                            {embed.thumbnail && (
                                <div className="p-4 pl-0">
                                    <img
                                        src={embed.thumbnail.url}
                                        alt="Thumbnail"
                                        className="w-20 h-20 rounded-md object-cover"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
