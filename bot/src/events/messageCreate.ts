import { Events, Message } from 'discord.js';
import { StatsService } from '../services/StatsService';

export default {
    name: Events.MessageCreate,
    once: false,
    async execute(message: Message) {
        console.log(`[DEBUG] Msg received: '${message.content}' from ${message.author.tag} in ${message.guild?.name}`);
        // Ignore direct messages and bot messages
        if (!message.guild || message.author.bot) {
            console.log('[DEBUG] Ignored (DM or Bot)');
            return;
        }

        try {
            await StatsService.trackMessage(
                message.guild.id,
                message.channel.id,
                message.author.id,
                message.content.length
            );
        } catch (error) {
            console.error('[Event:MessageCreate] Error tracking stats:', error);
        }
    },
};
