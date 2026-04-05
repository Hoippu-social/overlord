import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const CACHE_TTL_MS = 60_000;

const repoRoot = path.resolve(process.cwd(), '..');
const botRoot = path.join(repoRoot, 'bot');
const lavalinkRoot = path.join(repoRoot, 'lavalink');

export type MetricStatus = 'ok' | 'warning' | 'critical' | 'unknown';

export interface PathMetric {
    path: string | null;
    bytes: number | null;
    status: MetricStatus;
}

export interface DiskMetric {
    path: string;
    totalBytes: number | null;
    freeBytes: number | null;
    usedPercent: number | null;
    status: MetricStatus;
}

export interface SwapMetric {
    totalMb: number | null;
    usedMb: number | null;
    peakMb: number | null;
    status: MetricStatus;
}

export interface StorageDiagnostics {
    disk: DiskMetric;
    swap: SwapMetric;
    temp: PathMetric;
    npmCache: PathMetric;
    playwrightCache: PathMetric;
    workspaceCache: PathMetric;
    database: PathMetric;
    logs: PathMetric;
    backups: PathMetric;
    updatedAt: string;
}

let diagnosticsCache: { expiresAt: number; value: StorageDiagnostics } | null = null;

export async function getStorageDiagnostics(): Promise<StorageDiagnostics> {
    if (diagnosticsCache && diagnosticsCache.expiresAt > Date.now()) {
        return diagnosticsCache.value;
    }

    const value = await collectStorageDiagnostics();
    diagnosticsCache = {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return value;
}

export function getEmptyStorageDiagnostics(): StorageDiagnostics {
    const unknownPathMetric: PathMetric = {
        path: null,
        bytes: null,
        status: 'unknown',
    };

    return {
        disk: {
            path: process.platform === 'win32' ? 'C:' : '/',
            totalBytes: null,
            freeBytes: null,
            usedPercent: null,
            status: 'unknown',
        },
        swap: {
            totalMb: null,
            usedMb: null,
            peakMb: null,
            status: 'unknown',
        },
        temp: unknownPathMetric,
        npmCache: unknownPathMetric,
        playwrightCache: unknownPathMetric,
        workspaceCache: unknownPathMetric,
        database: unknownPathMetric,
        logs: unknownPathMetric,
        backups: unknownPathMetric,
        updatedAt: new Date(0).toISOString(),
    };
}

async function collectStorageDiagnostics(): Promise<StorageDiagnostics> {
    const tempPath = os.tmpdir();
    const npmCachePath = resolveNpmCachePath();
    const playwrightCachePath = resolvePlaywrightCachePath();

    const workspaceCacheLabel = `${path.join(process.cwd(), '.next')} + repo tmp`;
    const databaseLabel = `${path.join(repoRoot, '.postgres')} + ${path.join(botRoot, 'prisma')}`;
    const logsLabel = `${path.join(botRoot, 'combined.log')} + ${path.join(lavalinkRoot, 'logs')}`;

    const [
        disk,
        swap,
        tempBytes,
        npmCacheBytes,
        playwrightCacheBytes,
        workspaceCacheBytes,
        databaseBytes,
        logBytes,
        backupBytes,
    ] = await Promise.all([
        getDiskMetric(tempPath),
        getSwapMetric(),
        getPathSize(tempPath),
        npmCachePath ? getPathSize(npmCachePath) : Promise.resolve(null),
        playwrightCachePath ? getPathSize(playwrightCachePath) : Promise.resolve(null),
        getCompositeSize([
            path.join(process.cwd(), '.next'),
            path.join(process.cwd(), 'tmp'),
            path.join(process.cwd(), 'test-results'),
            path.join(repoRoot, 'tmp'),
        ]),
        getCompositeSize([
            path.join(repoRoot, '.postgres'),
            path.join(botRoot, 'prisma'),
        ]),
        getCompositeSize([
            path.join(botRoot, 'combined.log'),
            path.join(botRoot, 'error.log'),
            path.join(lavalinkRoot, 'logs'),
        ]),
        getPathSize(path.join(botRoot, 'backups')),
    ]);

    return {
        disk,
        swap,
        temp: buildPathMetric(tempPath, tempBytes, 2 * 1024 ** 3, 5 * 1024 ** 3),
        npmCache: buildPathMetric(npmCachePath, npmCacheBytes, 2 * 1024 ** 3, 5 * 1024 ** 3),
        playwrightCache: buildPathMetric(playwrightCachePath, playwrightCacheBytes, 512 * 1024 ** 2, 2 * 1024 ** 3),
        workspaceCache: buildPathMetric(workspaceCacheLabel, workspaceCacheBytes, 1024 ** 3, 2 * 1024 ** 3),
        database: buildPathMetric(databaseLabel, databaseBytes, 1024 ** 3, 5 * 1024 ** 3),
        logs: buildPathMetric(logsLabel, logBytes, 100 * 1024 ** 2, 500 * 1024 ** 2),
        backups: buildPathMetric(path.join(botRoot, 'backups'), backupBytes, 250 * 1024 ** 2, 1024 ** 3),
        updatedAt: new Date().toISOString(),
    };
}

function resolveNpmCachePath(): string | null {
    if (process.env.npm_config_cache) {
        return process.env.npm_config_cache;
    }

    if (process.platform === 'win32') {
        return process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'npm-cache') : null;
    }

    return path.join(os.homedir(), '.npm');
}

function resolvePlaywrightCachePath(): string | null {
    if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0') {
        return process.env.PLAYWRIGHT_BROWSERS_PATH;
    }

    if (process.platform === 'win32') {
        return process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : null;
    }

    return path.join(os.homedir(), '.cache', 'ms-playwright');
}

function buildPathMetric(targetPath: string | null, bytes: number | null, warningBytes: number, criticalBytes: number): PathMetric {
    return {
        path: targetPath,
        bytes,
        status: getByteStatus(bytes, warningBytes, criticalBytes),
    };
}

function getByteStatus(bytes: number | null, warningBytes: number, criticalBytes: number): MetricStatus {
    if (bytes === null) {
        return 'unknown';
    }

    if (bytes >= criticalBytes) {
        return 'critical';
    }

    if (bytes >= warningBytes) {
        return 'warning';
    }

    return 'ok';
}

async function getCompositeSize(pathsToScan: string[]): Promise<number | null> {
    let total = 0;
    let foundAnyPath = false;

    for (const targetPath of pathsToScan) {
        const size = await getPathSize(targetPath);
        if (size !== null) {
            total += size;
            foundAnyPath = true;
        }
    }

    return foundAnyPath ? total : null;
}

async function getPathSize(targetPath: string): Promise<number | null> {
    try {
        const stat = await fs.stat(targetPath);
        if (stat.isFile()) {
            return stat.size;
        }

        if (!stat.isDirectory()) {
            return 0;
        }
    } catch {
        return null;
    }

    let total = 0;
    const stack = [targetPath];

    while (stack.length > 0) {
        const currentPath = stack.pop();
        if (!currentPath) {
            continue;
        }

        let entries;
        try {
            entries = await fs.readdir(currentPath, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);

            try {
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                    continue;
                }

                if (entry.isFile()) {
                    total += (await fs.stat(fullPath)).size;
                }
            } catch {
                // Ignore locked or transient files while scanning cache directories.
            }
        }
    }

    return total;
}

async function getDiskMetric(targetPath: string): Promise<DiskMetric> {
    if (process.platform === 'win32') {
        return getWindowsDiskMetric(targetPath);
    }

    return getPosixDiskMetric(targetPath);
}

async function getWindowsDiskMetric(targetPath: string): Promise<DiskMetric> {
    const drive = path.parse(targetPath).root.replace(/[\\/]+$/, '');
    const fallback: DiskMetric = {
        path: drive || 'C:',
        totalBytes: null,
        freeBytes: null,
        usedPercent: null,
        status: 'unknown',
    };

    if (!drive) {
        return fallback;
    }

    try {
        const script = `Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${drive}'" | Select-Object Size,FreeSpace | ConvertTo-Json -Compress`;
        const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true });
        const parsed = parseJsonRecord(stdout);
        const totalBytes = parseNullableNumber(parsed?.Size);
        const freeBytes = parseNullableNumber(parsed?.FreeSpace);
        const usedPercent = totalBytes && freeBytes !== null
            ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100)
            : null;

        return {
            path: drive,
            totalBytes,
            freeBytes,
            usedPercent,
            status: getDiskStatus(totalBytes, freeBytes),
        };
    } catch {
        return fallback;
    }
}

async function getPosixDiskMetric(targetPath: string): Promise<DiskMetric> {
    const fallback: DiskMetric = {
        path: '/',
        totalBytes: null,
        freeBytes: null,
        usedPercent: null,
        status: 'unknown',
    };

    try {
        const { stdout } = await execFileAsync('df', ['-kP', targetPath]);
        const lines = stdout.trim().split(/\r?\n/);
        const line = lines[lines.length - 1];
        const parts = line.trim().split(/\s+/);

        if (parts.length < 6) {
            return fallback;
        }

        const totalBytes = Number(parts[1]) * 1024;
        const freeBytes = Number(parts[3]) * 1024;
        const usedPercent = Number(parts[4].replace('%', ''));

        return {
            path: parts[5],
            totalBytes: Number.isFinite(totalBytes) ? totalBytes : null,
            freeBytes: Number.isFinite(freeBytes) ? freeBytes : null,
            usedPercent: Number.isFinite(usedPercent) ? usedPercent : null,
            status: getDiskStatus(totalBytes, freeBytes),
        };
    } catch {
        return fallback;
    }
}

function getDiskStatus(totalBytes: number | null, freeBytes: number | null): MetricStatus {
    if (!totalBytes || freeBytes === null) {
        return 'unknown';
    }

    const freeRatio = freeBytes / totalBytes;
    if (freeRatio <= 0.1) {
        return 'critical';
    }

    if (freeRatio <= 0.2) {
        return 'warning';
    }

    return 'ok';
}

async function getSwapMetric(): Promise<SwapMetric> {
    if (process.platform === 'win32') {
        return getWindowsSwapMetric();
    }

    if (process.platform === 'darwin') {
        return getMacSwapMetric();
    }

    return getLinuxSwapMetric();
}

async function getWindowsSwapMetric(): Promise<SwapMetric> {
    const fallback: SwapMetric = {
        totalMb: null,
        usedMb: null,
        peakMb: null,
        status: 'unknown',
    };

    try {
        const script = 'Get-CimInstance Win32_PageFileUsage | Select-Object AllocatedBaseSize,CurrentUsage,PeakUsage | ConvertTo-Json -Compress';
        const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true });
        const records = parseJsonArray(stdout);

        if (records.length === 0) {
            return fallback;
        }

        const totalMb = sumNullableNumbers(records.map((record) => parseNullableNumber(record.AllocatedBaseSize)));
        const usedMb = sumNullableNumbers(records.map((record) => parseNullableNumber(record.CurrentUsage)));
        const peakMb = sumNullableNumbers(records.map((record) => parseNullableNumber(record.PeakUsage)));

        return {
            totalMb,
            usedMb,
            peakMb,
            status: getSwapStatus(totalMb, usedMb),
        };
    } catch {
        return fallback;
    }
}

async function getLinuxSwapMetric(): Promise<SwapMetric> {
    const fallback: SwapMetric = {
        totalMb: null,
        usedMb: null,
        peakMb: null,
        status: 'unknown',
    };

    try {
        const memInfo = await fs.readFile('/proc/meminfo', 'utf8');
        const totalKb = getMemInfoValue(memInfo, 'SwapTotal');
        const freeKb = getMemInfoValue(memInfo, 'SwapFree');

        if (totalKb === null || freeKb === null) {
            return fallback;
        }

        const totalMb = Math.round(totalKb / 1024);
        const usedMb = Math.max(0, Math.round((totalKb - freeKb) / 1024));

        return {
            totalMb,
            usedMb,
            peakMb: null,
            status: getSwapStatus(totalMb, usedMb),
        };
    } catch {
        return fallback;
    }
}

async function getMacSwapMetric(): Promise<SwapMetric> {
    const fallback: SwapMetric = {
        totalMb: null,
        usedMb: null,
        peakMb: null,
        status: 'unknown',
    };

    try {
        const { stdout } = await execFileAsync('sysctl', ['vm.swapusage']);
        const totalMb = parseSwapUnit(stdout, /total = ([0-9.]+)([A-Z])/i);
        const usedMb = parseSwapUnit(stdout, /used = ([0-9.]+)([A-Z])/i);

        return {
            totalMb,
            usedMb,
            peakMb: null,
            status: getSwapStatus(totalMb, usedMb),
        };
    } catch {
        return fallback;
    }
}

function getSwapStatus(totalMb: number | null, usedMb: number | null): MetricStatus {
    if (!totalMb || usedMb === null) {
        return 'unknown';
    }

    const usedRatio = usedMb / totalMb;
    if (usedRatio >= 0.5) {
        return 'critical';
    }

    if (usedRatio >= 0.25) {
        return 'warning';
    }

    return 'ok';
}

function getMemInfoValue(content: string, key: string): number | null {
    const match = content.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB$`, 'm'));
    return match?.[1] ? Number(match[1]) : null;
}

function parseSwapUnit(input: string, pattern: RegExp): number | null {
    const match = input.match(pattern);
    if (!match?.[1] || !match[2]) {
        return null;
    }

    const numeric = Number(match[1]);
    if (!Number.isFinite(numeric)) {
        return null;
    }

    const unit = match[2].toUpperCase();
    const multipliers: Record<string, number> = {
        B: 1 / (1024 ** 2),
        K: 1 / 1024,
        M: 1,
        G: 1024,
        T: 1024 ** 2,
    };

    return Math.round(numeric * (multipliers[unit] ?? 1));
}

function parseNullableNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function parseJsonRecord(input: string): Record<string, unknown> | null {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown> | Record<string, unknown>[];
        return Array.isArray(parsed) ? parsed[0] ?? null : parsed;
    } catch {
        return null;
    }
}

function parseJsonArray(input: string): Record<string, unknown>[] {
    const trimmed = input.trim();
    if (!trimmed) {
        return [];
    }

    try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown> | Record<string, unknown>[];
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [];
    }
}

function sumNullableNumbers(values: Array<number | null>): number | null {
    const filtered = values.filter((value): value is number => value !== null);
    if (filtered.length === 0) {
        return null;
    }

    return filtered.reduce((sum, value) => sum + value, 0);
}
