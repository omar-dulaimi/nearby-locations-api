import 'dotenv/config';
import { loadConfig } from './config.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await buildApp(config);
  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
