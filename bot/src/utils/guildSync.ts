import type { Guild } from 'discord.js';
import logger from './logger';
import { prisma } from './database';

export async function syncGuildData(guild: Guild) {
    if (guild.memberCount !== guild.members.cache.size) {
        try {
            await guild.members.fetch();
            logger.info(`Fetched ${guild.members.cache.size} members for ${guild.name}`);
        } catch (e) {
            logger.warn(`Failed to fetch members for ${guild.name}: ${e}`);
        }
    }

    const channels = guild.channels.cache.map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        position: c.position,
        parentId: c.parentId || null,
    }));

    const roles = guild.roles.cache.map((r: any) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        permissions: r.permissions.bitfield.toString(),
        position: r.position,
    }));

    const onlineCount = guild.members.cache.filter(m =>
        m.presence?.status === 'online' ||
        m.presence?.status === 'idle' ||
        m.presence?.status === 'dnd'
    ).size;

    await prisma.guild.upsert({
        where: { id: guild.id },
        update: {
            name: guild.name,
            icon: guild.icon,
            channels: JSON.stringify(channels),
            roles: JSON.stringify(roles),
            memberCount: guild.memberCount,
            onlineCount: onlineCount,
        },
        create: {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            channels: JSON.stringify(channels),
            roles: JSON.stringify(roles),
            memberCount: guild.memberCount,
            onlineCount: onlineCount,
        },
    });

    const musicConfig = await prisma.musicConfig.findUnique({ where: { guildId: guild.id } });
    if (!musicConfig) {
        await prisma.musicConfig.create({ data: { guildId: guild.id } });
    }
}

export async function cleanupGuildData(guildId: string) {
    try {
        await prisma.$transaction([
            prisma.userVoiceSettings.deleteMany({ where: { guildId } }),
            prisma.musicNowPlaying.deleteMany({ where: { guildId } }),
            prisma.tempVoiceConfig.deleteMany({ where: { guildId } }),
            prisma.musicConfig.deleteMany({ where: { guildId } }),
            prisma.botSettings.deleteMany({ where: { guildId } }),
            prisma.guild.deleteMany({ where: { id: guildId } }),
        ]);
    } catch (error) {
        logger.error(`[GuildSync] Failed to cleanup guild ${guildId}:`, error);
    }
}

