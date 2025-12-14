import { Client, Collection, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { Command } from '../utils/types';

export const commands = new Collection<string, Command>();

export async function loadCommands(client: Client) {
    const commandsPath = path.join(__dirname, '../commands');

    // Ensure directory exists
    if (!fs.existsSync(commandsPath)) {
        fs.mkdirSync(commandsPath);
    }

    // Function to recursively get all command files
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
        const command: Command = (await import(filePath)).default;

        if ('data' in command && 'execute' in command) {
            commands.set(command.data.name, command);
            commandsData.push(command.data.toJSON());
            logger.info(`Loaded command: ${command.data.name}`);
        } else {
            logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }

    // Register commands
    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

    try {
        logger.info('Started refreshing application (/) commands.');

        // If we have a specific GUILD_ID, we can register guild-only commands for faster updates during dev
        // Otherwise, register global commands
        if (process.env.CLIENT_ID) {
            if (process.env.GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                    { body: commandsData },
                );
                logger.info(`Successfully reloaded application (/) commands for guild ${process.env.GUILD_ID}.`);
            } else {
                await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: commandsData },
                );
                logger.info('Successfully reloaded application (/) commands globally.');
            }
        } else {
            logger.warn('CLIENT_ID not found in .env, skipping command registration.');
        }

    } catch (error) {
        logger.error('Error registering commands:', error);
    }
}
