// test-v2-components.js - Тестовый файл для проверки V2 компонентов
const { Client, GatewayIntentBits, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntents.MessageContent]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.content === '!testv2') {
        try {
            console.log('Creating V2 components...');

            // Простейший вариант - только текст
            const section = new SectionBuilder();
            const textDisplay = new TextDisplayBuilder()
                .setContent('# Test Title\nThis is a test of V2 components');

            section.addTextDisplayComponents(textDisplay);

            const components = [section];

            console.log('Components JSON:', JSON.stringify(components.map(c => c.toJSON()), null, 2));

            await message.channel.send({
                content: 'Testing V2 Components:',
                components
            });

            console.log('Message sent successfully!');
        } catch (error) {
            console.error('Error sending V2 components:', error);
            await message.channel.send(`Error: ${error.message}`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
