import { PrismaClient } from '@prisma/client';
import logger from './logger';

const prisma = new PrismaClient();

async function connectDB() {
    try {
        await prisma.$connect();
        logger.info('Database connected successfully');
    } catch (error) {
        logger.error('Database connection failed', error);
        process.exit(1);
    }
}

export { prisma, connectDB };
