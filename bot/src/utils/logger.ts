import winston from 'winston';

const LOG_MAX_SIZE = 10 * 1024 * 1024;
const LOG_MAX_FILES = 7;

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'error.log',
            level: 'error',
            maxsize: LOG_MAX_SIZE,
            maxFiles: LOG_MAX_FILES,
            tailable: true,
        }),
        new winston.transports.File({
            filename: 'combined.log',
            maxsize: LOG_MAX_SIZE,
            maxFiles: LOG_MAX_FILES,
            tailable: true,
        }),
    ],
});

export default logger;
