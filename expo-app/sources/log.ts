/**
 * Conditional logging mechanism with in-memory buffer for dev UI
 * - debug(): Only prints to console when debugEnabled is true, always stores in buffer
 * - warn()/error(): Always prints to console and stores in buffer
 * - Toggle debug mode via setDebug() or the dev settings page
 */
class Logger {
    private logs: string[] = [];
    private maxLogs = 5000;
    private listeners: Array<() => void> = [];
    private debugEnabled = false;

    /**
     * Store message in buffer, only print to console when debug is enabled
     */
    debug(...args: unknown[]): void {
        const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        this.addToBuffer(`[DEBUG] ${message}`);
        if (this.debugEnabled) {
            console.log(...args);
        }
    }

    /**
     * Backward-compatible alias for debug()
     */
    log(message: string): void {
        this.debug(message);
    }

    /**
     * Always prints to console - use for important warnings
     */
    warn(...args: unknown[]): void {
        const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        this.addToBuffer(`[WARN] ${message}`);
        console.warn(...args);
    }

    /**
     * Always prints to console - use for errors
     */
    error(...args: unknown[]): void {
        const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        this.addToBuffer(`[ERROR] ${message}`);
        console.error(...args);
    }

    /**
     * Enable or disable console output for debug logs
     */
    setDebug(enabled: boolean): void {
        this.debugEnabled = enabled;
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugEnabled(): boolean {
        return this.debugEnabled;
    }

    /**
     * Get all logs as a copy of the array
     */
    getLogs(): string[] {
        return [...this.logs];
    }

    /**
     * Clear all logs
     */
    clear(): void {
        this.logs = [];
        this.listeners.forEach(listener => listener());
    }

    /**
     * Subscribe to log changes - returns unsubscribe function
     */
    onChange(listener: () => void): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Get current number of logs
     */
    getCount(): number {
        return this.logs.length;
    }

    private addToBuffer(message: string): void {
        this.logs.push(message);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        this.listeners.forEach(listener => listener());
    }
}

// Export singleton instance
export const log = new Logger();