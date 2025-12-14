import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import pidusage from 'pidusage';
import treeKill from 'tree-kill';

class BotProcessManager {
    private botProcess: ChildProcess | null = null;
    private lavalinkProcess: ChildProcess | null = null;
    private botPath: string;
    private lavalinkPath: string;

    constructor() {
        this.botPath = path.resolve(process.cwd(), '../discordbot');
        this.lavalinkPath = path.resolve(process.cwd(), '../lavalink');
    }

    private startLavalink(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.lavalinkProcess) {
                resolve();
                return;
            }

            console.log('Starting Lavalink from:', this.lavalinkPath);

            // Spawn directly without shell to get the actual Java process PID
            this.lavalinkProcess = spawn('java', ['-jar', 'Lavalink.jar'], {
                cwd: this.lavalinkPath,
                shell: false,
                stdio: 'pipe',
            });

            this.lavalinkProcess.stdout?.on('data', (data) => {
                console.log(`[LAVALINK]: ${data}`);
                if (data.toString().includes('Lavalink is ready')) {
                    resolve();
                }
            });

            this.lavalinkProcess.stderr?.on('data', (data) => {
                console.error(`[LAVALINK ERROR]: ${data}`);
            });

            this.lavalinkProcess.on('close', (code) => {
                console.log(`Lavalink process exited with code ${code}`);
                this.lavalinkProcess = null;
            });

            // Timeout after 30 seconds
            setTimeout(() => resolve(), 30000);
        });
    }

    private startBotProcess() {
        if (this.botProcess) {
            throw new Error('Bot is already running');
        }

        console.log('Starting bot from:', this.botPath);

        // Use npm start with shell: true for compatibility
        this.botProcess = spawn('npm', ['start'], {
            cwd: this.botPath,
            shell: true,
            stdio: 'pipe',
        });

        this.botProcess.stdout?.on('data', (data) => {
            console.log(`[BOT]: ${data}`);
        });

        this.botProcess.stderr?.on('data', (data) => {
            console.error(`[BOT ERROR]: ${data}`);
        });

        this.botProcess.on('close', (code) => {
            console.log(`Bot process exited with code ${code}`);
            this.botProcess = null;
        });
    }

    private stopProcess(process: ChildProcess | null, name: string): Promise<void> {
        return new Promise((resolve) => {
            if (process && process.pid) {
                treeKill(process.pid, 'SIGTERM', (err) => {
                    if (err) console.error(`Error stopping ${name}:`, err);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    public async start() {
        // If partial state, stop everything first
        const status = this.getStatus();
        if (status.status === 'PARTIAL') {
            console.log('Partial state detected, stopping all processes first...');
            await this.stop();
            // Wait a bit for cleanup
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Start Lavalink first, then bot
        await this.startLavalink();
        this.startBotProcess();
    }

    public async stop() {
        // Stop bot first, then Lavalink
        await this.stopProcess(this.botProcess, 'bot');
        this.botProcess = null;

        await this.stopProcess(this.lavalinkProcess, 'Lavalink');
        this.lavalinkProcess = null;
    }

    public async kill() {
        if (this.botProcess && this.botProcess.pid) {
            treeKill(this.botProcess.pid, 'SIGKILL');
            this.botProcess = null;
        }
        if (this.lavalinkProcess && this.lavalinkProcess.pid) {
            treeKill(this.lavalinkProcess.pid, 'SIGKILL');
            this.lavalinkProcess = null;
        }
    }

    public async restart() {
        await this.stop();
        setTimeout(() => {
            this.start();
        }, 2000);
    }

    public getStatus() {
        const lavalinkRunning = this.lavalinkProcess !== null;
        const botRunning = this.botProcess !== null;

        let status: 'ONLINE' | 'PARTIAL' | 'OFFLINE';
        if (lavalinkRunning && botRunning) {
            status = 'ONLINE';
        } else if (lavalinkRunning || botRunning) {
            status = 'PARTIAL';
        } else {
            status = 'OFFLINE';
        }

        return {
            status,
            lavalink: lavalinkRunning,
            bot: botRunning,
            pid: this.botProcess?.pid || null
        };
    }

    public getBotStatus(): 'running' | 'stopped' {
        return this.botProcess ? 'running' : 'stopped';
    }

    public getLavalinkStatus(): 'running' | 'stopped' {
        return this.lavalinkProcess ? 'running' : 'stopped';
    }

    public async forceKill(): Promise<void> {
        const promises: Promise<void>[] = [];

        if (this.botProcess?.pid) {
            promises.push(new Promise((resolve) => {
                treeKill(this.botProcess!.pid!, 'SIGKILL', () => {
                    this.botProcess = null;
                    resolve();
                });
            }));
        }

        if (this.lavalinkProcess?.pid) {
            promises.push(new Promise((resolve) => {
                treeKill(this.lavalinkProcess!.pid!, 'SIGKILL', () => {
                    this.lavalinkProcess = null;
                    resolve();
                });
            }));
        }

        await Promise.all(promises);
    }

    public async startBot(): Promise<void> {
        await this.start();
    }

    public async stopBot(): Promise<void> {
        await this.stop();
    }

    public async restartBot(): Promise<void> {
        await this.restart();
    }

    public async getStats() {
        const status = this.getStatus();
        const pids: number[] = [];

        if (this.botProcess?.pid) pids.push(this.botProcess.pid);
        if (this.lavalinkProcess?.pid) pids.push(this.lavalinkProcess.pid);

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

            // Format uptime
            const uptimeStr = this.formatUptime(maxUptime);

            return {
                ...status,
                cpu: Math.round(totalCpu),
                memory: Math.round(totalMemory / (1024 * 1024)), // Convert to MB
                uptime: uptimeStr,
                ping: 24 // TODO: get real ping from Discord bot
            };
        } catch (error) {
            console.error('Error getting stats:', error);
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
