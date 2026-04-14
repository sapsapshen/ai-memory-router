// src/logger.ts

export const LOG_ENABLED = process.env.LOG_LEVEL !== 'silent';
export const DEBUG_ENABLED = process.env.LOG_LEVEL === 'debug';

const COLORS = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function log(message: string): void {
  if (LOG_ENABLED) {
    console.log(`${COLORS.gray}[${timestamp()}]${COLORS.reset} ${message}`);
  }
}

export function debug(message: string): void {
  if (DEBUG_ENABLED) {
    console.log(`${COLORS.gray}[${timestamp()}] [DEBUG]${COLORS.reset} ${message}`);
  }
}

export function warn(message: string): void {
  if (LOG_ENABLED) {
    console.warn(`${COLORS.yellow}[${timestamp()}] [WARN]${COLORS.reset} ${message}`);
  }
}

export function error(message: string): void {
  if (LOG_ENABLED) {
    console.error(`${COLORS.red}[${timestamp()}] [ERROR]${COLORS.reset} ${message}`);
  }
}

export function info(message: string): void {
  if (LOG_ENABLED) {
    console.info(`${COLORS.cyan}[${timestamp()}] [INFO]${COLORS.reset} ${message}`);
  }
}

// Safe wrapper for catch blocks - logs error without throwing
export function logError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  error(`${context}: ${message}`);
  if (err instanceof Error && err.stack) {
    debug(err.stack);
  }
}
