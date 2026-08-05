#!/usr/bin/env node

/**
 * Runs one or more apps in dev mode by name or alias:
 *
 *   pnpm dev dashboard
 *   pnpm dev konstruct-dashboard
 *   pnpm dev dashboard, dota
 *
 * Names may be separated by commas, spaces, or both. Every app runs in
 * parallel through pnpm, which prefixes each line with the package it came
 * from. Apps are registered in `scripts/apps.config.js`.
 */

import { spawn } from 'node:child_process';

import { apps } from './apps.config.js';

const nameByKey = new Map();
for (const app of apps) {
  nameByKey.set(app.name.toLowerCase(), app.name);
  for (const alias of app.aliases) {
    nameByKey.set(alias.toLowerCase(), app.name);
  }
}

function printUsage() {
  console.error('\nUsage: pnpm dev <app>[, <app>...]\n');
  console.error('Available apps:');
  for (const app of apps) {
    const aliases = app.aliases.length > 0 ? `  (${app.aliases.join(', ')})` : '';
    console.error(`  ${app.name}${aliases}`);
  }
  console.error('');
}

const requested = process.argv
  .slice(2)
  .join(' ')
  .split(/[\s,]+/)
  .filter(Boolean);

if (requested.length === 0) {
  console.error('No app given.');
  printUsage();
  process.exit(1);
}

const resolved = [];
const unknown = [];

for (const token of requested) {
  const name = nameByKey.get(token.toLowerCase());
  if (!name) {
    unknown.push(token);
  } else if (!resolved.includes(name)) {
    resolved.push(name);
  }
}

if (unknown.length > 0) {
  console.error(`Unknown app: ${unknown.join(', ')}`);
  printUsage();
  process.exit(1);
}

const args = ['--parallel', ...resolved.flatMap((name) => ['--filter', name]), 'run', 'dev'];
const child = spawn('pnpm', args, { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
