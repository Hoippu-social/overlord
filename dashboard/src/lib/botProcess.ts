import { exec, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pidusage from 'pidusage';
import treeKill from 'tree-kill';
import { promisify } from 'util';

const execAsync = promisify(exec);

type RuntimeMode = 'dev' | 'prod';

class BotProcessManager {
    private botPath: string;
    private lavalinkPath: string;
    private runtimeMode: RuntimeMode;
    private lastPingCheck = 0;
    private lastPingMs: number | null = null;

    constructor() {
        this.botPath = path.resolve(process.cwd(), '../bot');
        this.lavalinkPath = path.resolve(process.cwd(), '../lavalink');
        this.runtimeMode = process.env.BOT_PROCESS_MODE === 'prod' || process.env.NODE_ENV === 'production'
            ? 'prod'
            : 'dev';
    }

    private async findBotPid(): Promise<number | null> {
        const pidPath = path.join(this.botPath, 'bot.pid');

        try {
            if (!fs.existsSync(pidPath)) {
                return null;
            }

            const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);
            if (!pid || Number.isNaN(pid)) {
                return null;
            }

            try {
                process.kill(pid, 0);
                return pid;
            } catch {
                return null;
            }
        } catch (error) {
            console.error('Error finding bot PID:', error);
            return null;
        }
    }

    private async findLavalinkPid(): Promise<number | null> {
        try {
            const command = process.platform === 'win32'
                ? 'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq \'java.exe\' -and $_.CommandLine -like \'*Lavalink.jar*\' } | Select-Object -ExpandProperty ProcessId"'
                : 'ps -eo pid=,args= | grep "[L]avalink.jar"';
            const { stdout } = await execAsync(command);
            const pid = stdout
                .trim()
                .split(/\s+/)
                .find((value) => /^\d+$/.test(value));

            return pid ? parseInt(pid, 10) : null;
        } catch {
            return null;
        }
    }

    private async measurePing(): Promise<number | null> {
        const now = Date.now();
        if (now - this.lastPingCheck < 30_000 && this.lastPingMs !== null) {
            return this.lastPingMs;
        }

        this.lastPingCheck = now;

        try {
            const pingCommand = process.platform === 'win32'
                ? 'ping -n 1 discord.com'
                : 'ping -c 1 discord.com';
            const { stdout } = await execAsync(pingCommand);
            const match = stdout.match(/time[=<]?\s*(\d+)\s*ms/i);
            this.lastPingMs = match?.[1] ? parseInt(match[1], 10) : null;
        } catch (error) {
            console.error('Ping check failed:', error);
            this.lastPingMs = null;
        }

        return this.lastPingMs;
    }

    public async start() {
        const botPid = await this.findBotPid();
        const lavalinkPid = await this.findLavalinkPid();

        if (botPid && lavalinkPid) {
            console.log('Both processes already running.');
            return;
        }

        if (!lavalinkPid) {
            await this.startLavalink();
        }

        if (!botPid) {
            this.startBotProcess();
        }
    }

    private startLavalink(): Promise<void> {
        return new Promise((resolve) => {
            console.log('Starting Lavalink from:', this.lavalinkPath);

            const subprocess = process.platform === 'win32'
                ? spawn('cmd.exe', ['/c', 'start', '/min', path.join(this.lavalinkPath, 'start_lavalink.bat')], {
                    cwd: this.lavalinkPath,
                    detached: true,
                    stdio: 'ignore',
                    env: this.getLavalinkEnv(),
                })
                : spawn(process.env.LAVALINK_JAVA_BIN || 'java', [
                    ...this.getLavalinkJavaOpts(),
                    '-jar',
                    'Lavalink.jar',
                ], {
                    cwd: this.lavalinkPath,
                    detached: true,
                    stdio: 'ignore',
                    env: this.getLavalinkEnv(),
                });

            subprocess.unref();
            setTimeout(resolve, 5000);
        });
    }

    private startBotProcess() {
        console.log('Starting bot from:', this.botPath);

        const script = process.env.BOT_START_SCRIPT || (this.isProductionMode() ? 'start' : 'dev');
        const env = this.getBotEnv();
        const subprocess = process.platform === 'win32'
            ? spawn('cmd.exe', ['/c', 'start', '/min', 'npm', 'run', script], {
                cwd: this.botPath,
                detached: true,
                stdio: 'ignore',
                env,
            })
            : spawn('npm', ['run', script], {
                cwd: this.botPath,
                detached: true,
                stdio: 'ignore',
                env,
            });

        subprocess.unref();
    }

    public async stop() {
        const botPid = await this.findBotPid();
        const lavalinkPid = await this.findLavalinkPid();

        if (botPid) {
            console.log(`Stopping Bot (PID: ${botPid})...`);
            await this.killPid(botPid);
        }

        if (lavalinkPid) {
            console.log(`Stopping Lavalink (PID: ${lavalinkPid})...`);
            await this.killPid(lavalinkPid);
        }
    }

    public async restart() {
        await this.stop();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.start();
    }

    public async forceKill() {
        await this.stop();
    }

    private killPid(pid: number): Promise<void> {
        return new Promise((resolve) => {
            treeKill(pid, 'SIGTERM', (error) => {
                if (error) {
                    treeKill(pid, 'SIGKILL', () => resolve());
                } else {
                    resolve();
                }
            });
        });
    }

    public async getStatus() {
        const botPid = await this.findBotPid();
        const lavalinkPid = await this.findLavalinkPid();

        const botRunning = botPid !== null;
        const lavalinkRunning = lavalinkPid !== null;

        let status: 'ONLINE' | 'PARTIAL' | 'OFFLINE';
        if (botRunning && lavalinkRunning) {
            status = 'ONLINE';
        } else if (botRunning || lavalinkRunning) {
            status = 'PARTIAL';
        } else {
            status = 'OFFLINE';
        }

        return {
            status,
            lavalink: lavalinkRunning,
            bot: botRunning,
            botPid,
            lavalinkPid,
        };
    }

    public async getBotStatusStr(): Promise<'running' | 'stopped'> {
        const pid = await this.findBotPid();
        return pid ? 'running' : 'stopped';
    }

    public async getLavalinkStatusStr(): Promise<'running' | 'stopped'> {
        const pid = await this.findLavalinkPid();
        return pid ? 'running' : 'stopped';
    }

    public async getBotStatus(): Promise<'running' | 'stopped'> {
        return this.getBotStatusStr();
    }

    public async getLavalinkStatus(): Promise<'running' | 'stopped'> {
        return this.getLavalinkStatusStr();
    }

    public async startBot(): Promise<void> {
        const pid = await this.findBotPid();
        if (!pid) {
            this.startBotProcess();
        }
    }

    public async stopBot(): Promise<void> {
        const pid = await this.findBotPid();
        if (pid) {
            await this.killPid(pid);
        }
    }

    public async restartBot(): Promise<void> {
        await this.stopBot();
        setTimeout(() => void this.startBot(), 2000);
    }

    public async getStats() {
        const status = await this.getStatus();
        const pids: number[] = [];
        const totalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));
        const ping = await this.measurePing();

        if (status.botPid) {
            pids.push(status.botPid);
        }

        if (status.lavalinkPid) {
            pids.push(status.lavalinkPid);
        }

        if (pids.length === 0) {
            return {
                ...status,
                cpu: 0,
                memory: 0,
                totalMemory: totalMemoryMb,
                uptime: '0s',
                ping,
            };
        }

        try {
            const stats = await pidusage(pids);
            let totalCpu = 0;
            let totalMemory = 0;
            let maxUptime = 0;

            for (const pid of pids) {
                const stat = stats[pid];
                if (!stat) {
                    continue;
                }

                totalCpu += stat.cpu;
                totalMemory += stat.memory;
                if (stat.elapsed > maxUptime) {
                    maxUptime = stat.elapsed;
                }
            }

            return {
                ...status,
                cpu: Math.round(totalCpu * 10) / 10,
                memory: Math.round(totalMemory / (1024 * 1024)),
                totalMemory: totalMemoryMb,
                uptime: this.formatUptime(maxUptime),
                ping,
            };
        } catch (error) {
            console.error('Error getting PID stats:', error);
            return {
                ...status,
                cpu: 0,
                memory: 0,
                totalMemory: totalMemoryMb,
                uptime: '0s',
                ping: null,
            };
        }
    }

    private formatUptime(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
    }

    private isProductionMode(): boolean {
        return this.runtimeMode === 'prod';
    }

    private getBotEnv(): NodeJS.ProcessEnv {
        const nodeOptions = process.env.BOT_NODE_OPTIONS || (this.isProductionMode() ? '--max-old-space-size=512' : '');
        if (!nodeOptions) {
            return process.env;
        }

        return {
            ...process.env,
            NODE_OPTIONS: [process.env.NODE_OPTIONS, nodeOptions].filter(Boolean).join(' '),
        };
    }

    private getLavalinkEnv(): NodeJS.ProcessEnv {
        const javaOpts = process.env.LAVALINK_JAVA_OPTS || (this.isProductionMode() ? '-Xms128m -Xmx384m' : '');
        return {
            ...process.env,
            ...(javaOpts ? { LAVALINK_JAVA_OPTS: javaOpts } : {}),
        };
    }

    private getLavalinkJavaOpts(): string[] {
        const rawValue = process.env.LAVALINK_JAVA_OPTS || (this.isProductionMode() ? '-Xms128m -Xmx384m' : '');
        return rawValue.split(/\s+/).filter(Boolean);
    }

    private static instance: BotProcessManager;

    public static getInstance(): BotProcessManager {
        if (!BotProcessManager.instance) {
            BotProcessManager.instance = new BotProcessManager();
        }
        return BotProcessManager.instance;
    }
}

const botManager = BotProcessManager.getInstance();

export default botManager;
export { BotProcessManager };
