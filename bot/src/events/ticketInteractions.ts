import { Events, Interaction } from 'discord.js';
import logger from '../utils/logger';
import { handleTicketInteraction, isTicketInteraction } from '../services/TicketInteractionService';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (!isTicketInteraction(interaction)) {
            return;
        }

        try {
            await handleTicketInteraction(interaction, interaction.client);
        } catch (error) {
            logger.error('Error handling ticket interaction:', error);

            const reply = {
                content: 'Failed to process this action. Please try again.',
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
