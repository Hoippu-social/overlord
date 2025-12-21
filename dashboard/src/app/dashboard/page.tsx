'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardBody, CardFooter, Image, Button, Spinner, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { motion } from "framer-motion";
import { SignOut, Moon, Sun, List, CaretRight } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { signOut } from 'next-auth/react';
import { getStoredLocale } from '@/lib/i18n';

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
        themeLight: 'Light Mode',
        themeDark: 'Dark Mode',
        logout: 'Logout',
        manageSettings: 'Manage settings',
        unknownServer: 'Unknown Server',
        noServers: 'No servers found. Make sure the bot is running and has synced the data.',
    },
    ru: {
        loadingServers: 'Загрузка серверов...',
        title: 'Выберите сервер',
        subtitle: 'Выберите сервер для управления',
        themeLight: 'Светлая тема',
        themeDark: 'Тёмная тема',
        logout: 'Выйти',
        manageSettings: 'Управление',
        unknownServer: 'Неизвестный сервер',
        noServers: 'Серверы не найдены. Убедитесь, что бот запущен и синхронизировал данные.',
    },
} as const;

export default function Dashboard() {
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const [locale] = useState(getStoredLocale());
    const text = strings[locale];

    useEffect(() => {
        setMounted(true);
        fetch('/api/guilds')
            .then((res) => {
                if (res.status === 401) {
                    router.push('/login');
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
        await signOut({ callbackUrl: '/login' });
    };

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    if (loading || !mounted) {
        return (
            <div className="flex justify-center items-center h-screen bg-background">
                <Spinner size="lg" color="primary" label={text.loadingServers} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            {text.title}
                        </h1>
                        <p className="text-default-500 mt-2">{text.subtitle}</p>
                    </div>

                    <Dropdown>
                        <DropdownTrigger>
                            <Button isIconOnly variant="light" aria-label="Menu">
                                <List size={24} />
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Dashboard Actions">
                            <DropdownItem
                                key="theme"
                                startContent={theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                                onPress={toggleTheme}
                            >
                                {theme === 'dark' ? text.themeLight : text.themeDark}
                            </DropdownItem>
                            <DropdownItem
                                key="logout"
                                className="text-danger"
                                color="danger"
                                startContent={<SignOut size={20} />}
                                onPress={handleLogout}
                            >
                                {text.logout}
                            </DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </div>

                <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {guilds.map((guild, index) => (
                        <motion.div
                            key={guild.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Link href={`/dashboard/${guild.id}`}>
                                <Card className="w-full h-[220px] bg-surface border border-divider hover:border-primary/50 transition-colors">
                                    <CardBody className="flex items-center justify-center p-6 overflow-hidden">
                                        {guild.icon ? (
                                            <Image
                                                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                                                alt={guild.name || text.unknownServer}
                                                className="w-24 h-24 rounded-full object-cover shadow-lg"
                                                fallbackSrc="https://via.placeholder.com/150"
                                            />
                                        ) : (
                                            <div className="w-24 h-24 rounded-full bg-default-100 flex items-center justify-center text-3xl font-bold text-default-500 shadow-lg">
                                                {guild.name?.charAt(0) || '?'}
                                            </div>
                                        )}
                                    </CardBody>
                                    <CardFooter className="flex justify-between items-center px-6 pb-6 pt-0">
                                        <div className="flex flex-col">
                                            <h2 className="text-xl font-bold truncate max-w-[200px]">{guild.name || text.unknownServer}</h2>
                                            <p className="text-default-500 text-sm">{text.manageSettings}</p>
                                        </div>
                                        <Button isIconOnly variant="light" color="primary" radius="full">
                                            <CaretRight size={20} weight="bold" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </Link>
                        </motion.div>
                    ))}

                    {guilds.length === 0 && (
                        <div className="col-span-full text-center text-default-500 text-xl mt-10 p-8 border border-dashed border-divider rounded-2xl">
                            {text.noServers}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
