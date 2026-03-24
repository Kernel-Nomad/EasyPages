import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'tests'].filter((dir) => fs.existsSync(path.resolve(process.cwd(), dir)));

const collectJsFiles = (dir, out) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      collectJsFiles(full, out);
    } else if (ent.name.endsWith('.js')) {
      out.push(full);
    }
  }
};

const files = [];
for (const root of roots) {
  collectJsFiles(path.resolve(process.cwd(), root), files);
}

files.sort();
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

const rootFiles = ['server.js', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js'];
for (const name of rootFiles) {
  const full = path.resolve(process.cwd(), name);
  if (!fs.existsSync(full)) {
    continue;
  }
  const r = spawnSync(process.execPath, ['--check', full], { stdio: 'inherit' });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

const scriptsDir = path.resolve(process.cwd(), 'scripts');
if (fs.existsSync(scriptsDir)) {
  for (const ent of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.mjs')) {
      continue;
    }
    const full = path.join(scriptsDir, ent.name);
    const r = spawnSync(process.execPath, ['--check', full], { stdio: 'inherit' });
    if (r.status !== 0) {
      process.exit(r.status ?? 1);
    }
  }
}
