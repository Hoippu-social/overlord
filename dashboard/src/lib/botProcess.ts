import { spawn, exec, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import pidusage from 'pidusage';
import treeKill from 'tree-kill';
import { promisify } from 'util';

const execAsync = promisify(exec);

class BotProcessManager {
    private botPath: string;
    private lavalinkPath: string;

    constructor() {
        this.botPath = path.resolve(process.cwd(), '../bot');
        this.lavalinkPath = path.resolve(process.cwd(), '../lavalink');
    }

    private async findBotPid(): Promise<number | null> {
        // Try reading bot.pid
        const pidPath = path.join(this.botPath, 'bot.pid');
        try {
            if (fs.existsSync(pidPath)) {
                const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());
                if (!pid || isNaN(pid)) return null;

                // Verify if process exists
                try {
                    process.kill(pid, 0);
                    return pid;
                } catch (e) {
                    // Process doesn't exist, stale file
                    return null;
                }
            }
        } catch (error) {
            console.error('Error finding bot PID:', error);
        }
        return null;
    }

    private async findLavalinkPid(): Promise<number | null> {
        try {
            // Windows specific check
            const { stdout } = await execAsync('wmic process where "name=\'java.exe\' and commandline like \'%Lavalink.jar%\'" get processid');
            const lines = stdout.trim().split(/\s+/);
            // stdout looks like: "ProcessId \n 12345"
            // Filter strict numbers
            const pids = lines.filter(l => /^\d+$/.test(l));
            if (pids.length > 0) {
                return parseInt(pids[0]);
            }
        } catch (error) {
            // Fail silently, maybe not running
        }
        return null;
    }

    public async start() {
        // Check if already running
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
            // Use the batch file because it contains the absolute path to Java
            const batFile = path.join(this.lavalinkPath, 'start_lavalink.bat');

            // "start" command opens a new window, which helps ensuring it runs detached and environment is correct
            const subprocess = spawn('cmd.exe', ['/c', 'start', '/min', batFile], {
                cwd: this.lavalinkPath,
                detached: true,
                stdio: 'ignore'
            });

            subprocess.unref();

            // Give it some time to start
            setTimeout(resolve, 5000);
        });
    }

    private startBotProcess() {
        console.log('Starting bot from:', this.botPath);
        // Also use start_bot.bat if it exists, roughly similar logic
        // But we previously used npm run dev directly. Let's stick to what works but ensure env.

        const command = 'npm';
        const args = ['run', 'dev'];

        const subprocess = spawn('cmd.exe', ['/c', 'start', '/min', command, ...args], {
            cwd: this.botPath,
            detached: true,
            stdio: 'ignore'
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
        // Wait 2s
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.start();
    }

    public async forceKill() {
        await this.stop();
    }

    private killPid(pid: number): Promise<void> {
        return new Promise((resolve) => {
            treeKill(pid, 'SIGTERM', (err) => {
                if (err) {
                    // Try force kill
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
            lavalinkPid
        };
    }

    // Compat methods
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
        if (!pid) this.startBotProcess();
    }

    public async stopBot(): Promise<void> {
        const pid = await this.findBotPid();
        if (pid) await this.killPid(pid);
    }

    public async restartBot(): Promise<void> {
        await this.stopBot();
        setTimeout(() => this.startBot(), 2000);
    }

    public async getStats() {
        const status = await this.getStatus();
        const pids: number[] = [];

        if (status.botPid) pids.push(status.botPid);
        if (status.lavalinkPid) pids.push(status.lavalinkPid);

        if (pids.length === 0) {
            return {
                ...status,
                cpu: 0,
                memory: 0,
                uptime: '0s',
                ping: 0
            };
        }

        try {
            const stats = await pidusage(pids);
            let totalCpu = 0;
            let totalMemory = 0;
            let maxUptime = 0;

            for (const pid of pids) {
                const stat = stats[pid];
                if (stat) {
                    totalCpu += stat.cpu;
                    totalMemory += stat.memory;
                    if (stat.elapsed > maxUptime) maxUptime = stat.elapsed;
                }
            }

            return {
                ...status,
                cpu: Math.round(totalCpu * 10) / 10,
                memory: Math.round(totalMemory / (1024 * 1024)),
                uptime: this.formatUptime(maxUptime),
                ping: 24
            };
        } catch (error) {
            console.error('Error getting PID stats:', error);
            return {
                ...status,
                cpu: 0,
                memory: 0,
                uptime: '0s',
                ping: 0
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
