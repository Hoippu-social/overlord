import { prisma } from '@/lib/prisma';
import { AppealSettings, DEFAULT_APPEAL_SETTINGS, normalizeAppealSettings } from '@/lib/appealsSettings';

export * from '@/lib/appealsSettings';

export async function readAppealSettings(guildId: string): Promise<AppealSettings> {
    const config = await prisma.appealConfig.findUnique({
        where: { guildId },
        select: { settingsJson: true },
    });

    const settingsJson = config?.settingsJson;
    if (!settingsJson) {
        return DEFAULT_APPEAL_SETTINGS;
    }

    try {
        return normalizeAppealSettings(JSON.parse(settingsJson));
    } catch {
        return DEFAULT_APPEAL_SETTINGS;
    }
}

export async function writeAppealSettings(guildId: string, settings: AppealSettings) {
    const normalized = normalizeAppealSettings(settings);
    await prisma.appealConfig.update({
        where: { guildId },
        data: { settingsJson: JSON.stringify(normalized) },
    });
}
