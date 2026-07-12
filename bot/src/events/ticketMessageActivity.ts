import { ChannelType, Events, Message } from 'discord.js';
import { bumpTicketActivity } from '../services/TicketInteractionService';

export default {
    name: Events.MessageCreate,
    async execute(message: Message) {
        if (message.author.bot) return;
        if (message.channel.type !== ChannelType.PrivateThread && message.channel.type !== ChannelType.PublicThread) return;
        await bumpTicketActivity(message.channel.id).catch(() => null);
    },
};
