import { prisma } from './database';
import logger from './logger';

type CommandChannelAccessOptions = {
    guildId: string;
    channelId?: string | null;
    parentChannelId?: string | null;
};

const parseStringArray = (value: string | null | undefined) => {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && Boolean(item)) : [];
    } catch {
        return [];
    }
};

const normalizeMode = (value: string | null | undefined) =>
    value?.toUpperCase() === 'WHITELIST' ? 'WHITELIST' : 'BLACKLIST';

export async function isCommandAllowedInChannel({
    guildId,
    channelId,
    parentChannelId,
}: CommandChannelAccessOptions) {
    try {
        const settings = await prisma.botSettings.findUnique({
            where: { guildId },
            select: {
                commandChannelMode: true,
                allowedTextChannels: true,
            },
        });

        const configuredChannelIds = parseStringArray(settings?.allowedTextChannels);
        if (configuredChannelIds.length === 0) {
            return true;
        }

        const activeChannelIds = new Set<string>();
        if (channelId) {
            activeChannelIds.add(channelId);
        }
        if (parentChannelId) {
            activeChannelIds.add(parentChannelId);
        }

        const matches = configuredChannelIds.some((configuredId) => activeChannelIds.has(configuredId));
        return normalizeMode(settings?.commandChannelMode) === 'WHITELIST' ? matches : !matches;
    } catch (error) {
        logger.error('Failed to resolve global command channel restrictions:', error);
        return true;
    }
}
