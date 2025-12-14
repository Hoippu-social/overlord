import logger from './logger';
import { logActivity } from './activityLogger';

/**
 * Centralized bot activity logger.
 * Logs to Winston (file/console) and also stores an in‑memory entry for the last 30 minutes.
 */
export function botLog(message: string): void {
    logger.info(message);
    logActivity(message);
}
