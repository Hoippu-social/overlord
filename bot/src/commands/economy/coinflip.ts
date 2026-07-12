import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { ACCENT, cardReply } from '../../utils/economyCards';
import { ecoCopy } from '../../utils/economyI18n';
import { renderCoinflipPrompt } from '../../utils/economyGameCards';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('coinflip')
            .addIntegerOption((o) =>
                localizeDescription(o.setName('bet'), {
                    en: 'How much to bet',
                    ru: 'Сколько поставить',
                })
                    .setMinValue(1)
                    .setRequired(true)
            ),
        { en: 'Flip a coin — heads or tails', ru: 'Подбросить монетку — орёл или решка' }
    ),
    execute: async (interaction) => {
        const guildId = interaction.guildId;
        if (!guildId) return;
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
        if (!cfg.gamblingEnabled) {
            await interaction.reply(
                cardReply({ accent: ACCENT.neutral, title: c.coinflip.title, body: [c.game.gamblingDisabled] }, { ephemeral: true })
            );
            return;
        }

        const bet = BigInt(interaction.options.getInteger('bet', true));
        await interaction.reply(cardReply(renderCoinflipPrompt(bet, interaction.user.id, locale, currency)));
    },
};

export default command;
