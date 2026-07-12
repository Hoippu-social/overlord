import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { ACCENT, cardReply, money } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('pay')
            .addUserOption((opt) =>
                localizeDescription(opt.setName('user').setRequired(true), {
                    en: 'Who to pay',
                    ru: 'Кому перевести',
                })
            )
            .addIntegerOption((opt) =>
                localizeDescription(opt.setName('amount').setRequired(true).setMinValue(1), {
                    en: 'Amount to send',
                    ru: 'Сумма перевода',
                })
            ),
        {
            en: 'Transfer currency to another member',
            ru: 'Перевести валюту другому участнику',
        }
    ),
    execute: async (interaction) => {
        if (!interaction.guildId) return;
        const guildId = interaction.guildId;
        const locale = await getInteractionLocale(interaction);
        const c = ecoCopy(locale);
        const cfg = await EconomyService.getConfig(guildId);
        const currency = { name: cfg.currencyName, emoji: cfg.currencyEmoji };

        if (!cfg.enabled) {
            await interaction.reply(
                cardReply({ accent: ACCENT.neutral, title: c.common.error, body: [c.common.disabled] }, { ephemeral: true })
            );
            return;
        }

        const targetUser = interaction.options.getUser('user', true);
        const amountRaw = interaction.options.getInteger('amount', true);

        if (targetUser.id === interaction.user.id) {
            await interaction.reply(
                cardReply({ accent: ACCENT.danger, title: c.pay.title, body: [c.pay.selfPay] }, { ephemeral: true })
            );
            return;
        }

        if (amountRaw <= 0) {
            await interaction.reply(
                cardReply({ accent: ACCENT.danger, title: c.pay.title, body: [c.pay.badAmount] }, { ephemeral: true })
            );
            return;
        }

        const amount = BigInt(amountRaw);
        const bps = cfg.transferCommissionBps;

        const result = await EconomyService.transfer(
            {
                guildId,
                fromUserId: interaction.user.id,
                toUserId: targetUser.id,
                amount,
                commissionBps: bps,
            },
            interaction.client
        );

        if (!result.ok) {
            const body = result.reason === 'BLACKLISTED' ? c.common.blacklisted : c.common.insufficient;
            await interaction.reply(
                cardReply({ accent: ACCENT.danger, title: c.pay.title, body: [body] }, { ephemeral: true })
            );
            return;
        }

        const commission = bps ? (amount * BigInt(bps)) / 10000n : 0n;

        await interaction.reply(
            cardReply({
                accent: ACCENT.primary,
                title: c.pay.title,
                body: [fmt(c.pay.sent, { amount: money(amount, currency), user: `<@${targetUser.id}>` })],
                footer: commission > 0n ? fmt(c.pay.commission, { amount: money(commission, currency) }) : undefined,
            })
        );
    },
};

export default command;
