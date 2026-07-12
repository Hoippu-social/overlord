import { SlashCommandBuilder } from 'discord.js';
import type { EconomyInventoryItem, EconomyShopItem } from '@prisma/client';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { EconomyShopService } from '../../services/EconomyShopService';
import { ACCENT, cardReply } from '../../utils/economyCards';
import { ecoCopy } from '../../utils/economyI18n';

type InventoryRow = EconomyInventoryItem & { shopItem: EconomyShopItem };

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('inventory'), {
        en: 'View your inventory',
        ru: 'Посмотреть свой инвентарь',
    }),
    execute: async (interaction) => {
        if (!interaction.guildId) return;
        const guildId = interaction.guildId;
        const locale = await getInteractionLocale(interaction);
        const c = ecoCopy(locale);
        const cfg = await EconomyService.getConfig(guildId);

        if (!cfg.enabled) {
            await interaction.reply(
                cardReply({ accent: ACCENT.neutral, title: c.common.error, body: [c.common.disabled] }, { ephemeral: true })
            );
            return;
        }

        const rows = (await EconomyShopService.listInventory(guildId, interaction.user.id)) as InventoryRow[];

        if (rows.length === 0) {
            await interaction.reply(
                cardReply({ accent: ACCENT.neutral, title: c.inventory.title, body: [c.inventory.empty] }, { ephemeral: true })
            );
            return;
        }

        const body = rows.map((r) => {
            const heading = `**#${r.id} · ${r.shopItem.emoji ? `${r.shopItem.emoji} ` : ''}${r.shopItem.name}**`;
            const expiry = r.roleExpiresAt ? ` · <t:${Math.floor(r.roleExpiresAt.getTime() / 1000)}:R>` : '';
            return `${heading}\n-# ${r.shopItem.type}${expiry}`;
        });

        await interaction.reply(
            cardReply({ accent: ACCENT.violet, title: c.inventory.title, body }, { ephemeral: true })
        );
    },
};

export default command;
