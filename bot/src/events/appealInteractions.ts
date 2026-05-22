import { Events, Interaction } from 'discord.js';
import logger from '../utils/logger';
import { handleAppealInteraction, isAppealInteraction } from '../services/AppealInteractionService';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (!isAppealInteraction(interaction)) {
            return;
        }

        try {
            await handleAppealInteraction(interaction, interaction.client);
        } catch (error) {
            logger.error('Error handling appeal interaction:', error);

            const reply = {
                content: 'Не удалось обработать апелляцию.',
                ephemeral: true,
            };

            if (interaction.isRepliable()) {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply).catch(() => null);
                } else {
                    await interaction.reply(reply).catch(() => null);
                }
            }
        }
    },
};
