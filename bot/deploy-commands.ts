import { REST, Routes } from 'discord.js';
// import { loadCommands } from './handlers/commandHandler';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Mock client just enough to load commands
const client = new Client({ intents: [] });
// We need to attach lavalink mock or ignore it?
// loadCommands uses 'utils/types' Command interface so it should be fine.

async function register() {
    console.log('Started refreshing application (/) commands.');

    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;

    if (!token) {
        throw new Error('Missing DISCORD_TOKEN in .env');
    }
    if (!clientId) {
        throw new Error('Missing CLIENT_ID in .env');
    }

    const commandsPath = path.join(__dirname, 'src/commands');
    const getCommandFiles = (dir: string): string[] => {
        let files: string[] = [];
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
            if (item.isDirectory()) {
                files = [...files, ...getCommandFiles(path.join(dir, item.name))];
            } else if (item.name.endsWith('.ts') || item.name.endsWith('.js')) {
                files.push(path.join(dir, item.name));
            }
        }
        return files;
    };

    const commandFiles = getCommandFiles(commandsPath);
    const commandsData = [];

    for (const filePath of commandFiles) {
        // Use dynamic import
        try {
            const commandModule = await import(filePath);
            const command = commandModule.default;
            if ('data' in command && 'execute' in command) {
                if (command.hidden) {
                    console.log(`Skipping hidden command: ${command.data.name}`);
                    continue;
                }
                commandsData.push(command.data.toJSON());
                console.log(`Loaded command: ${command.data.name}`);
            } else {
                console.warn(`[WARNING] The command at ${filePath} is missing "data" or "execute".`);
            }
        } catch (e) {
            console.error(`[ERROR] loading ${filePath}:`, e);
        }
    }

    const rest = new REST().setToken(token);

    try {
        console.log(`Registering ${commandsData.length} commands completely...`);

        // Register Global
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commandsData },
        );
        console.log('Successfully reloaded application (/) commands globally.');

        // If Guild ID is present, try register there too for instant update
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
                { body: commandsData },
            );
            console.log(`Successfully reloaded application (/) commands for guild ${process.env.GUILD_ID}.`);
        }

    } catch (error) {
        console.error(error);
    }
}

register();
