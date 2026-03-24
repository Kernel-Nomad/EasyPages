import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const testsRoot = path.resolve(process.cwd(), 'tests');

const collectTestFiles = (dir, out) => {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      collectTestFiles(full, out);
    } else if (ent.name.endsWith('.test.js')) {
      out.push(full);
    }
  }
};

const files = [];
collectTestFiles(testsRoot, files);

if (files.length === 0) {
  console.warn('No hay archivos *.test.js en tests/');
  process.exit(0);
}

files.sort();
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
