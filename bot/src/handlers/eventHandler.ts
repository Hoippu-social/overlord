import { Client } from 'discord.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

export async function loadEvents(client: Client) {
    const eventsPath = path.join(__dirname, '../events');

    // Ensure directory exists
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath);
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = (await import(filePath)).default;

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        logger.info(`Loaded event: ${event.name}`);
    }
}
