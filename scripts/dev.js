#!/usr/bin/env node

/**
 * Runs apps in dev mode by name, alias or group:
 *
 *   pnpm dev                      every app
 *   pnpm dev dashboard            one app
 *   pnpm dev dota                 a group — both halves of the product
 *   pnpm dev dota-server          one half
 *   pnpm dev dashboard, dota      any mix
 *
 * Names may be separated by commas, spaces, or both. Everything runs in
 * parallel through pnpm, which prefixes each line with the package it came
 * from. Apps and groups are registered in `scripts/apps.config.js`.
 */

import { spawn } from 'node:child_process';

import { apps, groups } from './apps.config.js';

const nameByKey = new Map();
for (const app of apps) {
  nameByKey.set(app.name.toLowerCase(), app.name);
  for (const alias of app.aliases) {
    nameByKey.set(alias.toLowerCase(), app.name);
  }
}

const groupByKey = new Map();
for (const [group, members] of Object.entries(groups)) {
  groupByKey.set(group.toLowerCase(), members);
}

/* A name that is both a group and an app would silently resolve to one of
   them. Fail loudly at startup instead of guessing. */
for (const group of groupByKey.keys()) {
  if (nameByKey.has(group)) {
    console.error(`Config error: "${group}" is both a group and an app name or alias.`);
    process.exit(1);
  }
}

function printUsage() {
  console.error('\nUsage: pnpm dev [<app|group>[, <app|group>...]]');
  console.error('With no arguments, every app runs.\n');
  console.error('Apps:');
  for (const app of apps) {
    const aliases = app.aliases.length > 0 ? `  (${app.aliases.join(', ')})` : '';
    console.error(`  ${app.name}${aliases}`);
  }
  if (groupByKey.size > 0) {
    console.error('\nGroups:');
    for (const [group, members] of groupByKey) {
      console.error(`  ${group}  -> ${members.join(', ')}`);
    }
  }
  console.error('');
}

const requested = process.argv
  .slice(2)
  .join(' ')
  .split(/[\s,]+/)
  .filter(Boolean);

const resolved = [];
const unknown = [];

const add = (name) => {
  if (!resolved.includes(name)) {
    resolved.push(name);
  }
};

if (requested.length === 0) {
  // No arguments: run everything.
  for (const app of apps) {
    add(app.name);
  }
} else {
  for (const token of requested) {
    const key = token.toLowerCase();
    const members = groupByKey.get(key);

    if (members) {
      for (const member of members) {
        add(member);
      }
      continue;
    }

    const name = nameByKey.get(key);
    if (name) {
      add(name);
    } else {
      unknown.push(token);
    }
  }
}

if (unknown.length > 0) {
  console.error(`Unknown app or group: ${unknown.join(', ')}`);
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
