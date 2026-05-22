import { SlashCommandBuilder } from 'discord.js';
import { createAppealTicket, listAppealTickets, safeEnsureAppealConfig } from '../../services/AppealService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

async function resolveAppealGuild(interaction: Parameters<Command['execute']>[0]) {
    if (interaction.guild) {
        return interaction.guild;
    }

    const serverId = interaction.options.getString('server_id');
    if (!serverId) {
        return null;
    }

    return interaction.client.guilds.fetch(serverId).catch(() => null);
}

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('appeal')
            .setDMPermission(true)
            .addSubcommand((sub: any) =>
                localizeDescription(sub.setName('submit'), {
                    en: 'Submit an appeal for one of your moderation cases',
                    ru: 'Подать апелляцию на один из ваших кейсов',
                })
                    .addIntegerOption((option: any) =>
                        localizeDescription(option.setName('case_id').setRequired(true).setMinValue(1), {
                            en: 'Moderation case number',
                            ru: 'Номер модераторского кейса',
                        })
                    )
                    .addStringOption((option: any) =>
                        localizeDescription(option.setName('message').setRequired(true).setMaxLength(1000), {
                            en: 'Why this case should be reviewed',
                            ru: 'Почему этот кейс должен быть пересмотрен',
                        })
                    )
                    .addStringOption((option: any) =>
                        localizeDescription(option.setName('server_id').setRequired(false), {
                            en: 'Server ID for DM fallback',
                            ru: 'ID сервера для подачи через ЛС',
                        })
                    )
            )
            .addSubcommand((sub: any) =>
                localizeDescription(sub.setName('mine'), {
                    en: 'Show your recent appeal tickets',
                    ru: 'Показать ваши недавние тикеты апелляции',
                })
                    .addStringOption((option: any) =>
                        localizeDescription(option.setName('server_id').setRequired(false), {
                            en: 'Server ID for DM fallback',
                            ru: 'ID сервера для просмотра через ЛС',
                        })
                    )
            ),
        {
            en: 'Submit or view your moderation appeals',
            ru: 'Подать апелляцию или посмотреть свои апелляции',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'appeal',
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        const guild = await resolveAppealGuild(interaction);
        if (!guild) {
            await interaction.reply({
                content: interaction.inGuild()
                    ? t(locale, 'general.guildOnly')
                    : 'Укажите `server_id`, чтобы подать апелляцию через ЛС.',
                ephemeral: true,
            });
            return;
        }

        const config = await safeEnsureAppealConfig(guild.id);
        if (!config?.enabled) {
            await interaction.reply({ content: t(locale, 'moderation.appeals.disabled'), ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'mine') {
            const tickets = await listAppealTickets(guild.id, {
                userId: interaction.user.id,
                limit: 10,
            });

            if (!tickets.length) {
                await interaction.reply({ content: t(locale, 'moderation.appeal.none'), ephemeral: true });
                return;
            }

            await interaction.reply({
                content: tickets
                    .map((ticket) => `#${ticket.id} - ${ticket.appealType} - #${ticket.caseNumber} - ${ticket.status}`)
                    .join('\n')
                    .slice(0, 1900),
                ephemeral: true,
            });
            return;
        }

        try {
            const ticket = await createAppealTicket({
                guild,
                userId: interaction.user.id,
                caseNumber: interaction.options.getInteger('case_id', true),
                message: interaction.options.getString('message', true),
                client: interaction.client,
            });

            await interaction.reply({
                content: t(locale, 'moderation.appeal.created', {
                    ticketId: ticket.id,
                    caseNumber: ticket.caseNumber,
                }),
                ephemeral: true,
            });
        } catch {
            await interaction.reply({
                content: t(locale, 'moderation.appeal.failedCreate'),
                ephemeral: true,
            });
        }
    },
};

export default command;
