import { Logger } from 'next-axiom';

type LogContext = {
  tenant_id?: string;
  user_id?: string;
  action?: string;
  duration_ms?: number;
  [key: string]: unknown;
};

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatEntry(level: LogLevel, ctx: LogContext): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    level,
    ...ctx,
  };
}

function devLog(level: LogLevel, ctx: LogContext): void {
  const entry = formatEntry(level, ctx);
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(JSON.stringify(entry, null, 2));
}

const isProd = process.env.NEXT_PUBLIC_ENV === 'production';

const axiomLogger = isProd ? new Logger() : null;

export const logger = {
  debug(ctx: LogContext): void {
    if (isProd) {
      axiomLogger?.debug(ctx.action ?? 'debug', ctx);
    } else {
      devLog('debug', ctx);
    }
  },

  info(ctx: LogContext): void {
    if (isProd) {
      axiomLogger?.info(ctx.action ?? 'info', ctx);
    } else {
      devLog('info', ctx);
    }
  },

  warn(ctx: LogContext): void {
    if (isProd) {
      axiomLogger?.warn(ctx.action ?? 'warn', ctx);
    } else {
      devLog('warn', ctx);
    }
  },

  error(ctx: LogContext): void {
    if (isProd) {
      axiomLogger?.error(ctx.action ?? 'error', ctx);
    } else {
      devLog('error', ctx);
    }
  },
};
