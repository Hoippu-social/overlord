import { Events, Interaction, MessageFlags } from 'discord.js';
import logger from '../utils/logger';
import { handleEconomyInteraction, isEconomyInteraction } from '../services/EconomyInteractionService';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (!isEconomyInteraction(interaction)) return;

        try {
            await handleEconomyInteraction(interaction);
        } catch (error) {
            logger.error('Error handling economy interaction:', error);
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction
                    .reply({ content: 'Failed to process this action.', flags: MessageFlags.Ephemeral })
                    .catch(() => null);
            }
        }
    },
};
