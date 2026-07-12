import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { EconomyShopService } from '../../services/EconomyShopService';
import { ACCENT, cardReply, money, type CardSelect } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('shop'), {
        en: 'Browse the server shop',
        ru: 'Открыть магазин сервера',
    }),
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

        const items = await EconomyShopService.listShopItems(guildId, { onlyEnabled: true });

        if (items.length === 0) {
            await interaction.reply(
                cardReply({ accent: ACCENT.neutral, title: c.shop.title, body: [c.shop.empty] })
            );
            return;
        }

        const body = items.map((i) => {
            const heading = `**${i.emoji ? `${i.emoji} ` : ''}${i.name}** — ${money(i.price, currency)}`;
            const stock = i.stock != null ? fmt(c.shop.stock, { n: i.stock }) : c.shop.unlimited;
            return `${heading}\n-# ${i.type} · ${stock}`;
        });

        const select: CardSelect = {
            id: 'eco:shop:buy',
            placeholder: c.shop.pick,
            options: items.slice(0, 25).map((i) => ({
                label: i.name,
                value: String(i.id),
                description: money(i.price, currency),
                emoji: i.emoji ?? undefined,
            })),
        };

        await interaction.reply(
            cardReply({ accent: ACCENT.gold, title: c.shop.title, body, selects: [select] })
        );
    },
};

export default command;
