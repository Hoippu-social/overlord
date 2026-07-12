import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { prisma } from '../../utils/database';
import { ACCENT, cardReply, money } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const command: Command = {
    accessGroup: 'admin',
    accessKey: 'economy-admin',
    data: (localizeDescription(new SlashCommandBuilder().setName('economy-admin'), {
        en: 'Economy administration',
        ru: 'Администрирование экономики',
    }) as SlashCommandBuilder)
        .addSubcommand((s) =>
            localizeDescription(
                s.setName('grant')
                    .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true))
                    .addIntegerOption((o) => o.setName('amount').setDescription('Amount').setMinValue(1).setRequired(true)),
                { en: 'Grant currency to a member', ru: 'Выдать валюту участнику' }
            )
        )
        .addSubcommand((s) =>
            localizeDescription(
                s.setName('deduct')
                    .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true))
                    .addIntegerOption((o) => o.setName('amount').setDescription('Amount').setMinValue(1).setRequired(true)),
                { en: 'Deduct currency from a member', ru: 'Списать валюту у участника' }
            )
        )
        .addSubcommand((s) =>
            localizeDescription(
                s.setName('blacklist').addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true)),
                { en: 'Exclude a member from the economy', ru: 'Исключить участника из экономики' }
            )
        )
        .addSubcommand((s) =>
            localizeDescription(
                s.setName('unblacklist').addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true)),
                { en: 'Restore a member to the economy', ru: 'Вернуть участника в экономику' }
            )
        ),
    execute: async (interaction) => {
        if (!interaction.guildId) return;
        const guildId = interaction.guildId;
        const locale = await getInteractionLocale(interaction);
        const c = ecoCopy(locale);
        const cfg = await EconomyService.getConfig(guildId);
        const currency = { name: cfg.currencyName, emoji: cfg.currencyEmoji };
        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user', true);

        if (sub === 'grant' || sub === 'deduct') {
            const amount = BigInt(interaction.options.getInteger('amount', true));
            const params = {
                guildId,
                userId: target.id,
                account: 'WALLET' as const,
                amount,
                type: (sub === 'grant' ? 'ADMIN_GRANT' : 'ADMIN_DEDUCT') as 'ADMIN_GRANT' | 'ADMIN_DEDUCT',
                actorId: interaction.user.id,
                metadata: { reason: 'admin-command' },
            };
            const result = sub === 'grant'
                ? await EconomyService.credit(params, interaction.client)
                : await EconomyService.debit(params, interaction.client);

            if (!result.ok) {
                await interaction.reply(cardReply({ accent: ACCENT.danger, title: c.common.error, body: [fmt(c.admin.failed, { reason: result.reason })] }, { ephemeral: true }));
                return;
            }

            const line = sub === 'grant'
                ? fmt(c.admin.granted, { amount: money(amount, currency), user: `<@${target.id}>` })
                : fmt(c.admin.deducted, { amount: money(amount, currency), user: `<@${target.id}>` });
            await interaction.reply(cardReply({ accent: ACCENT.primary, title: '⚙️', body: [line] }, { ephemeral: true }));
            return;
        }

        const blacklisted = sub === 'blacklist';
        await prisma.economyMember.upsert({
            where: { guildId_userId: { guildId, userId: target.id } },
            update: {
                blacklistedAt: blacklisted ? new Date() : null,
                blacklistReason: blacklisted ? 'admin-command' : null,
                blacklistedBy: blacklisted ? interaction.user.id : null,
            },
            create: {
                guildId,
                userId: target.id,
                blacklistedAt: blacklisted ? new Date() : null,
                blacklistReason: blacklisted ? 'admin-command' : null,
                blacklistedBy: blacklisted ? interaction.user.id : null,
            },
        });

        const line = blacklisted
            ? fmt(c.admin.blacklisted, { user: `<@${target.id}>` })
            : fmt(c.admin.unblacklisted, { user: `<@${target.id}>` });
        await interaction.reply(cardReply({ accent: ACCENT.info, title: '⚙️', body: [line] }, { ephemeral: true }));
    },
};

export default command;
