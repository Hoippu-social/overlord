import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const BACKUP_DIR = path.join(__dirname, '../../backups');
const MAX_BACKUPS = 7;
const postgresBinDir = process.env.POSTGRES_BIN_DIR || 'D:/Program Files/PostgreSQL/17/bin';

type DatabaseBackupTarget = {
    label: 'main' | 'stats';
    envName: 'DATABASE_URL' | 'STATS_PG_DATABASE_URL';
};

const BACKUP_TARGETS: DatabaseBackupTarget[] = [
    { label: 'main', envName: 'DATABASE_URL' },
    { label: 'stats', envName: 'STATS_PG_DATABASE_URL' },
];

function requirePostgresUrl(name: string): string {
    const value = process.env[name];
    if (!value || !/^postgres(ql)?:\/\//i.test(value)) {
        throw new Error(`${name} must be configured as a PostgreSQL connection string`);
    }
    return value;
}

export class BackupService {
    static async createBackup(): Promise<void> {
        try {
            if (!fs.existsSync(BACKUP_DIR)) {
                fs.mkdirSync(BACKUP_DIR, { recursive: true });
            }

            const dateStr = new Date().toISOString().slice(0, 10);
            for (const target of BACKUP_TARGETS) {
                const backupPath = path.join(BACKUP_DIR, `${target.label}_${dateStr}.dump`);
                this.createPostgresBackup(target.envName, backupPath);
                const sizeKB = Math.round(fs.statSync(backupPath).size / 1024);
                console.log(`[Backup] Created ${path.basename(backupPath)} (${sizeKB} KB)`);
            }

            this.pruneOldBackups();
        } catch (error) {
            console.error('[Backup] Backup failed:', error);
        }
    }

    static async checkAndBackupOnStartup(): Promise<void> {
        try {
            if (!fs.existsSync(BACKUP_DIR)) {
                fs.mkdirSync(BACKUP_DIR, { recursive: true });
            }

            const backups = this.getBackupsList();
            if (backups.length === 0) {
                console.log('[Backup] No PostgreSQL backups found, creating initial backup...');
                await this.createBackup();
                return;
            }

            const latest = backups[backups.length - 1];
            const latestStat = fs.statSync(latest);
            const ageHours = (Date.now() - latestStat.mtimeMs) / (1000 * 60 * 60);

            if (ageHours >= 24) {
                console.log(`[Backup] Last backup is ${Math.floor(ageHours)}h old, creating fresh backup...`);
                await this.createBackup();
            } else {
                console.log(`[Backup] Backup is fresh (${Math.floor(ageHours)}h ago): ${path.basename(latest)}`);
            }
        } catch (error) {
            console.error('[Backup] Startup check failed:', error);
        }
    }

    private static getBackupsList(): string[] {
        if (!fs.existsSync(BACKUP_DIR)) {
            return [];
        }

        return fs.readdirSync(BACKUP_DIR)
            .filter((file) => (file.startsWith('main_') || file.startsWith('stats_')) && file.endsWith('.dump'))
            .map((file) => path.join(BACKUP_DIR, file))
            .sort();
    }

    private static pruneOldBackups(): void {
        for (const prefix of ['main_', 'stats_']) {
            const backups = this.getBackupsList().filter((file) => path.basename(file).startsWith(prefix));
            if (backups.length <= MAX_BACKUPS) continue;

            const toDelete = backups.slice(0, backups.length - MAX_BACKUPS);
            for (const backup of toDelete) {
                try {
                    fs.unlinkSync(backup);
                    console.log(`[Backup] Pruned old backup: ${path.basename(backup)}`);
                } catch (error) {
                    console.error(`[Backup] Failed to prune ${backup}:`, error);
                }
            }
        }
    }

    private static createPostgresBackup(envName: DatabaseBackupTarget['envName'], backupPath: string): void {
        const connectionString = requirePostgresUrl(envName);
        const parsed = new URL(connectionString);
        const database = parsed.pathname.replace(/^\//, '');
        const host = parsed.hostname || '127.0.0.1';
        const port = parsed.port || '5432';
        const user = decodeURIComponent(parsed.username || 'postgres');
        const password = decodeURIComponent(parsed.password || '');
        const pgDumpPath = path.join(postgresBinDir, 'pg_dump.exe');

        const result = spawnSync(
            pgDumpPath,
            ['-h', host, '-p', port, '-U', user, '-d', database, '-F', 'c', '-f', backupPath],
            {
                env: {
                    ...process.env,
                    PGPASSWORD: password,
                },
                stdio: 'pipe',
            }
        );

        if (result.status !== 0) {
            throw new Error(result.stderr?.toString() || result.stdout?.toString() || 'pg_dump failed');
        }
    }
}
