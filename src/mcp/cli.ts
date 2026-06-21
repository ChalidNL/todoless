#!/usr/bin/env node
import { loadConfig } from './core';
import { startHttp, startStdio } from './server';

async function main() {
  const config = loadConfig();
  if (config.transport === 'http') {
    await startHttp(config);
  } else {
    await startStdio(config);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
