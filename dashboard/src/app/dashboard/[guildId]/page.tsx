'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Chip } from "@nextui-org/react";
import { MusicWidget } from '@/components/MusicWidget';
import {
    ShieldCheck,
    Scroll,
    Coins,
    Ticket,
    Gear,
    Users,
    ChatCircleDots,
    Pulse,
    CaretRight
} from "@phosphor-icons/react";
import Link from 'next/link';

export default function HubPage({ params }: { params: Promise<{ guildId: string }> }) {
    // Unwrap params
    const { guildId } = React.use(params);

    const modules = [
        { label: 'Moderation', href: `/dashboard/${guildId}/moderation`, icon: ShieldCheck, color: 'text-primary', desc: 'Auto-mod, warnings, and bans' },
        { label: 'Audit Logs', href: `/dashboard/${guildId}/audit`, icon: Scroll, color: 'text-warning', desc: 'Track server events' },
        { label: 'Economy', href: `/dashboard/${guildId}/economy`, icon: Coins, color: 'text-success', desc: 'Currency, shop, and items' },
        { label: 'Tickets', href: `/dashboard/${guildId}/tickets`, icon: Ticket, color: 'text-secondary', desc: 'Support system management' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard Hub</h1>
                    <p className="text-default-500">Overview and quick actions for your server</p>
                </div>
                <Chip color="success" variant="flat" startContent={<Pulse size={16} weight="fill" />}>
                    System Online
                </Chip>
            </div>

            {/* Top Row: Music Widget & Stats */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Music Widget (Takes 2 columns on large screens) */}
                <div className="xl:col-span-2">
                    <MusicWidget />
                </div>

                {/* Stats Column */}
                <div className="space-y-6">
                    <Card className="bg-surface border border-divider">
                        <CardBody className="flex flex-row items-center gap-4 p-6">
                            <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                <Users size={32} weight="fill" />
                            </div>
                            <div>
                                <p className="text-default-500 text-sm">Total Members</p>
                                <h3 className="text-2xl font-bold">1,234</h3>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="flex flex-row items-center gap-4 p-6">
                            <div className="p-3 rounded-xl bg-success/10 text-success">
                                <ChatCircleDots size={32} weight="fill" />
                            </div>
                            <div>
                                <p className="text-default-500 text-sm">Active Chats</p>
                                <h3 className="text-2xl font-bold">89</h3>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider flex-1">
                        <CardHeader className="pb-0 pt-4 px-4 flex-col items-start">
                            <h4 className="font-bold text-large">Recent Activity</h4>
                        </CardHeader>
                        <CardBody className="px-4 py-2">
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                        <span className="text-default-500">User joined the server</span>
                                        <span className="text-xs text-default-400 ml-auto">2m ago</span>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>

            {/* Modules Grid */}
            <h2 className="text-xl font-bold mt-8 mb-4">Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {modules.map((mod) => (
                    <Link key={mod.href} href={mod.href}>
                        <Card className="h-full bg-surface border border-divider hover:border-primary/50 transition-colors cursor-pointer group">
                            <CardBody className="p-6 flex flex-col gap-4">
                                <div className={`p-3 w-fit rounded-xl bg-default-100 group-hover:bg-primary/10 group-hover:${mod.color} transition-colors`}>
                                    <mod.icon size={32} weight="fill" className="text-default-500 group-hover:text-inherit transition-colors" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{mod.label}</h3>
                                    <p className="text-default-500 text-sm mt-1">{mod.desc}</p>
                                </div>
                                <div className="mt-auto pt-4 flex items-center text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                                    Manage <CaretRight size={16} className="ml-1" />
                                </div>
                            </CardBody>
                        </Card>
                    </Link>
                ))}

                <Link href={`/dashboard/${guildId}/settings`}>
                    <Card className="h-full bg-surface border border-divider hover:border-primary/50 transition-colors cursor-pointer group border-dashed">
                        <CardBody className="p-6 flex flex-col gap-4 items-center justify-center text-center h-full">
                            <div className="p-3 w-fit rounded-xl bg-default-100 group-hover:bg-default-200 transition-colors">
                                <Gear size={32} weight="fill" className="text-default-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">General Settings</h3>
                                <p className="text-default-500 text-sm mt-1">Configure bot basics</p>
                            </div>
                        </CardBody>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
