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
            .setName('bank')
            .addSubcommand((sub) =>
                localizeDescription(
                    sub.setName('deposit').addIntegerOption((opt) =>
                        localizeDescription(opt.setName('amount').setRequired(true).setMinValue(1), {
                            en: 'Amount to deposit',
                            ru: 'Сумма для внесения',
                        })
                    ),
                    { en: 'Deposit money into the bank', ru: 'Внести деньги в банк' }
                )
            )
            .addSubcommand((sub) =>
                localizeDescription(
                    sub.setName('withdraw').addIntegerOption((opt) =>
                        localizeDescription(opt.setName('amount').setRequired(true).setMinValue(1), {
                            en: 'Amount to withdraw',
                            ru: 'Сумма для снятия',
                        })
                    ),
                    { en: 'Withdraw money from the bank', ru: 'Снять деньги из банка' }
                )
            ),
        {
            en: 'Move money between your wallet and bank',
            ru: 'Перемещать деньги между кошельком и банком',
        }
    ),
    execute: async (interaction) => {
        if (!interaction.guildId) return;
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
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

        const sub = interaction.options.getSubcommand();
        const amountRaw = interaction.options.getInteger('amount', true);

        if (amountRaw <= 0) {
            await interaction.reply(
                cardReply({ accent: ACCENT.danger, title: c.common.error, body: [c.bank.badAmount] }, { ephemeral: true })
            );
            return;
        }

        const amount = BigInt(amountRaw);
        const fromAccount = sub === 'deposit' ? 'WALLET' : 'BANK';
        const toAccount = sub === 'deposit' ? 'BANK' : 'WALLET';
        const ledgerType = sub === 'deposit' ? 'DEPOSIT' : 'WITHDRAW';

        const debitResult = await EconomyService.debit(
            { guildId, userId, account: fromAccount, amount, type: ledgerType },
            interaction.client
        );

        if (!debitResult.ok) {
            const body =
                debitResult.reason === 'BLACKLISTED' ? c.common.blacklisted : c.common.insufficient;
            await interaction.reply(
                cardReply({ accent: ACCENT.danger, title: c.common.error, body: [body] }, { ephemeral: true })
            );
            return;
        }

        await EconomyService.credit(
            { guildId, userId, account: toAccount, amount, type: ledgerType },
            interaction.client
        );

        const member = await EconomyService.getOrCreateMember(guildId, userId);
        const moved = money(amount, currency);

        await interaction.reply(
            cardReply({
                accent: ACCENT.primary,
                title: c.common.bank,
                body: [sub === 'deposit' ? fmt(c.bank.deposited, { amount: moved }) : fmt(c.bank.withdrew, { amount: moved })],
                fields: [
                    { label: c.common.wallet, value: money(member.wallet, currency) },
                    { label: c.common.bank, value: money(member.bank, currency) },
                ],
            })
        );
    },
};

export default command;
