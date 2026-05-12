import type { PinoLoggerOptions } from 'fastify/types/logger.js';

export function buildLoggerOptions(nodeEnv: string, level: string): PinoLoggerOptions | boolean {
  if (nodeEnv === 'test') return false; // silent during tests unless overridden
  const opts: PinoLoggerOptions = { level };
  if (nodeEnv === 'development') {
    opts.transport = {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    };
  }
  return opts;
}
