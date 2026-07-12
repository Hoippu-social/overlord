import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { EconomyShopService } from '../../services/EconomyShopService';
import { ACCENT, cardReply } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const command: Command = {
    data: localizeDescription(
        (new SlashCommandBuilder().setName('use') as SlashCommandBuilder).addIntegerOption((o) =>
            localizeDescription(o.setName('item').setMinValue(1).setRequired(true), {
                en: 'Inventory item id',
                ru: 'ID предмета из инвентаря',
            })
        ),
        { en: 'Use an item from your inventory', ru: 'Использовать предмет из инвентаря' }
    ),
    execute: async (interaction) => {
        if (!interaction.guildId) return;
        const guildId = interaction.guildId;
        const locale = await getInteractionLocale(interaction);
        const c = ecoCopy(locale);
        const cfg = await EconomyService.getConfig(guildId);

        if (!cfg.enabled) {
            await interaction.reply(cardReply({ accent: ACCENT.neutral, title: c.common.error, body: [c.common.disabled] }, { ephemeral: true }));
            return;
        }

        const inventoryItemId = interaction.options.getInteger('item', true);
        const result = await EconomyShopService.useItem({ guildId, userId: interaction.user.id, inventoryItemId });

        if (!result.ok) {
            await interaction.reply(cardReply({ accent: ACCENT.danger, title: c.inventory.title, body: [c.common.error] }, { ephemeral: true }));
            return;
        }

        await interaction.reply(
            cardReply(
                { accent: ACCENT.primary, title: c.inventory.title, body: [fmt(c.inventory.used, { item: result.effect ?? String(inventoryItemId) })] },
                { ephemeral: true }
            )
        );
    },
};

export default command;
