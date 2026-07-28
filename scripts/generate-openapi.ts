import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';

const OUT = fileURLToPath(new URL('../docs/openapi.json', import.meta.url));

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const app = await buildApp(
    loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'x', LOCATIONS_FILE: './data/locations.json' }),
    { logger: false },
  );
  await app.ready();
  const doc = JSON.stringify(app.swagger(), null, 2) + '\n';
  await app.close();
  if (check) {
    let current = '';
    try {
      current = readFileSync(OUT, 'utf8');
    } catch {
      /* missing */
    }
    if (current !== doc) {
      console.error(
        'docs/openapi.json is out of date. Run `npm run openapi` and commit the result.',
      );
      process.exit(1);
    }
    console.log('docs/openapi.json is up to date.');
  } else {
    writeFileSync(OUT, doc);
    console.log(`Wrote ${OUT}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
