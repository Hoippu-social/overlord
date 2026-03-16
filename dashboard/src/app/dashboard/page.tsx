'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Image, Button, Spinner } from "@nextui-org/react";
import { motion } from "framer-motion";
import { SignOut, CaretRight, RocketLaunch } from "@phosphor-icons/react";
import { signOut } from 'next-auth/react';
import { getStoredLocale } from '@/lib/i18n';
import { FastAverageColor } from 'fast-average-color';

interface Guild {
    id: string;
    name: string | null;
    icon: string | null;
}

const strings = {
    en: {
        loadingServers: 'Loading servers...',
        title: 'Select a Server',
        subtitle: 'Choose a server to manage',
        logout: 'Logout',
        manageSettings: 'Manage settings',
        unknownServer: 'Unknown Server',
        noServers: 'No servers found. Make sure the bot is running and has synced the data.',
    },
    ru: {
        loadingServers: 'Загрузка серверов...',
        title: 'Выберите сервер',
        subtitle: 'Выберите сервер для управления',
        logout: 'Выйти',
        manageSettings: 'Управление',
        unknownServer: 'Неизвестный сервер',
        noServers: 'Серверы не найдены. Убедитесь, что бот запущен и синхронизировал данные.',
    },
} as const;

function ServerCard({ guild, index, text }: { guild: Guild, index: number, text: any }) {
    const [color, setColor] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        if (guild.icon) {
            const fac = new FastAverageColor();
            const imgUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
            fac.getColorAsync(imgUrl, { crossOrigin: 'anonymous' })
                .then(color => {
                    if (mounted) setColor(color.hex);
                })
                .catch(e => {
                    console.error('Error getting color:', e);
                });
        }
        return () => { mounted = false; };
    }, [guild.id, guild.icon]);

    const dominantColor = color || '#75F16A';
    const shadowColor = color ? `${color}40` : 'rgba(117,241,106,0.1)';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
        >
            <Link href={`/dashboard/${guild.id}`}>
                <div
                    className="group relative w-full h-[220px] bg-[#111111] border border-white/[0.06] hover:border-[color:var(--dominant-color)] rounded-[24px] overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_var(--shadow-color)] flex flex-col items-center justify-center p-6"
                    style={{
                        '--dominant-color': dominantColor,
                        '--shadow-color': shadowColor,
                    } as React.CSSProperties}
                >
                    <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                        style={{
                            background: `linear-gradient(to bottom right, ${dominantColor}15, transparent)`
                        }}
                    />

                    <div className="relative mb-5">
                        {guild.icon ? (
                            <Image
                                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                                alt={guild.name || text.unknownServer}
                                className="w-[84px] h-[84px] rounded-[22px] object-cover shadow-2xl border border-white/10 group-hover:scale-110 transition-transform duration-500"
                                fallbackSrc="https://via.placeholder.com/150"
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <div className="w-[84px] h-[84px] rounded-[22px] bg-white/[0.04] border border-white/10 flex items-center justify-center text-4xl font-akony text-white/50 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                {guild.name?.charAt(0) || '?'}
                            </div>
                        )}
                    </div>

                    <h2
                        className="text-lg font-bold text-[#e5e5e5] truncate max-w-full text-center px-4 transition-colors duration-300 group-hover:text-[color:var(--dominant-color)]"
                    >
                        {guild.name || text.unknownServer}
                    </h2>
                    <p className="text-white/40 text-sm mt-1">{text.manageSettings}</p>

                    <div
                        className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center text-white/50 opacity-0 transform translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 group-hover:text-[color:var(--dominant-color)] overflow-hidden"
                    >
                        <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                            style={{ backgroundColor: dominantColor }}
                        />
                        <CaretRight size={16} weight="bold" className="relative z-10" />
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

export default function Dashboard() {
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();
    const [locale] = useState(getStoredLocale());
    const text = strings[locale];

    useEffect(() => {
        setMounted(true);
        fetch('/api/guilds')
            .then(async (res) => {
                if (res.status === 401 || res.status === 403) {
                    await fetch('/api/logout', { method: 'POST' });
                    await signOut({ callbackUrl: '/login' });
                    return [];
                }
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    setGuilds(data);
                }
            })
            .finally(() => setLoading(false));
    }, [router]);

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        await signOut({ callbackUrl: '/login' });
    };

    if (loading || !mounted) {
        return (
            <div className="flex justify-center items-center h-screen bg-[#1a1a1a]">
                <Spinner size="lg" color="success" label={text.loadingServers} classNames={{ label: "text-[#75F16A]" }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#1a1a1a] text-[#e5e5e5] p-8 pb-32">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-16 mt-8">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-[18px] bg-[#75F16A]/10 flex items-center justify-center text-[#75F16A] shadow-lg border border-[#75F16A]/20">
                                <RocketLaunch size={24} weight="fill" />
                            </div>
                            <h1 className="text-4xl font-akony bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent transform translate-y-1">
                                {text.title}
                            </h1>
                        </div>
                        <p className="text-white/40 text-lg">{text.subtitle}</p>
                    </div>

                    <Button
                        variant="flat"
                        color="danger"
                        startContent={<SignOut size={20} weight="bold" />}
                        onPress={handleLogout}
                        className="bg-danger/10 text-danger hover:bg-danger/20 font-bold px-6 h-12 rounded-xl"
                    >
                        {text.logout}
                    </Button>
                </div>

                <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {guilds.map((guild, index) => (
                        <ServerCard key={guild.id} guild={guild} index={index} text={text} />
                    ))}

                    {guilds.length === 0 && (
                        <div className="col-span-full text-center text-white/40 text-lg mt-12 p-12 border border-dashed border-white/10 rounded-3xl bg-[#111111]">
                            {text.noServers}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
