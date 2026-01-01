import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = new Set(process.argv.slice(2));
const FIX = args.has('--fix');

const repoRoot = process.cwd();

const roots = [
  path.join(repoRoot, 'plexify-shared-ui', 'src', 'assets'),
  path.join(repoRoot, 'public', 'assets'),
  path.join(repoRoot, 'src', 'assets'),
];

const exists = async (p) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

const shouldIgnoreDir = (dirName) =>
  dirName === 'node_modules' ||
  dirName === 'dist' ||
  dirName === '.git' ||
  dirName === '.turbo';

const walk = async (dir) => {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) continue;
      out.push(...(await walk(path.join(dir, entry.name))));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
};

const hasConflictMarkers = (s) =>
  s.includes('<<<<<<<') || s.includes('=======') || s.includes('>>>>>>>');

const rel = (p) => path.relative(repoRoot, p);

let errors = 0;
let warnings = 0;
let optimized = 0;

let svgoOptimize = null;
if (FIX) {
  try {
    const svgo = await import('svgo');
    svgoOptimize = svgo.optimize;
  } catch {
    console.warn('[assets:check] svgo not installed; skipping --fix optimization');
  }
}

const svgFiles = [];
for (const root of roots) {
  if (!(await exists(root))) continue;
  svgFiles.push(...(await walk(root)));
}

if (svgFiles.length === 0) {
  console.log('[assets:check] No SVG files found under configured roots.');
  process.exit(0);
}

for (const filePath of svgFiles) {
  const stat = await fs.stat(filePath);
  const bytes = stat.size;

  if (bytes > 300 * 1024) {
    warnings += 1;
    console.warn(`[assets:check] WARN large SVG (${Math.round(bytes / 1024)}KB): ${rel(filePath)}`);
  }

  const text = await fs.readFile(filePath, 'utf8');
  if (hasConflictMarkers(text)) {
    errors += 1;
    console.error(`[assets:check] ERROR conflict markers found: ${rel(filePath)}`);
    continue;
  }

  if (!text.includes('<svg')) {
    warnings += 1;
    console.warn(`[assets:check] WARN missing <svg tag: ${rel(filePath)}`);
  }

  if (FIX && svgoOptimize) {
    const result = svgoOptimize(text, {
      path: filePath,
      multipass: true,
    });
    if (result?.data && result.data !== text) {
      await fs.writeFile(filePath, result.data, 'utf8');
      optimized += 1;
      console.log(`[assets:check] optimized: ${rel(filePath)}`);
    }
  }
}

const summary = `[assets:check] done (svg=${svgFiles.length}, optimized=${optimized}, warnings=${warnings}, errors=${errors})`;
if (errors > 0) {
  console.error(summary);
  process.exit(1);
}

console.log(summary);
