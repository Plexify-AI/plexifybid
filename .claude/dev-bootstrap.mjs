import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worktreeRoot = path.resolve(__dirname, '..');
const mainRepo = 'C:\\Dev\\plexifybid';
const nmLink = path.join(worktreeRoot, 'node_modules');
const nmSource = path.join(mainRepo, 'node_modules');

// Copy .env.local if needed
const envTarget = path.join(worktreeRoot, '.env.local');
const envSource = path.join(mainRepo, '.env.local');
if (!fs.existsSync(envTarget) && fs.existsSync(envSource)) {
  fs.copyFileSync(envSource, envTarget);
}

// Remove broken node_modules if it exists but is empty/broken
if (fs.existsSync(nmLink) && !fs.existsSync(path.join(nmLink, 'vite'))) {
  console.log('[bootstrap] Removing broken node_modules...');
  try {
    const stat = fs.lstatSync(nmLink);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(nmLink);
    } else {
      fs.rmSync(nmLink, { recursive: true, force: true });
    }
    console.log('[bootstrap] Removed broken node_modules');
  } catch (err) {
    console.error('[bootstrap] Failed to remove broken node_modules:', err.message);
  }
}

// Create node_modules junction if it doesn't exist
if (!fs.existsSync(nmLink)) {
  console.log('[bootstrap] Creating node_modules junction...');
  try {
    // Use node's fs.symlinkSync with 'junction' type (Windows-specific, no admin needed)
    fs.symlinkSync(nmSource, nmLink, 'junction');
    console.log('[bootstrap] Junction created successfully');
  } catch (err) {
    console.error('[bootstrap] Junction failed:', err.code, err.message);
    // Fallback: try via cmd.exe
    try {
      execFileSync('cmd.exe', ['/c', 'mklink', '/J', nmLink, nmSource], { stdio: 'pipe' });
      console.log('[bootstrap] cmd mklink junction created');
    } catch (err2) {
      console.error('[bootstrap] cmd mklink also failed:', err2.message);
      // Last fallback: run npm install
      console.log('[bootstrap] Falling back to npm install...');
      try {
        execFileSync('npm.cmd', ['install', '--prefer-offline'], {
          cwd: worktreeRoot,
          stdio: 'inherit',
          timeout: 120000
        });
      } catch (err3) {
        console.error('[bootstrap] npm install failed:', err3.message);
        process.exit(1);
      }
    }
  }
}

// Verify node_modules exists
if (!fs.existsSync(path.join(nmLink, 'vite'))) {
  console.error('[bootstrap] node_modules/vite not found after setup. Exiting.');
  process.exit(1);
}

console.log('[bootstrap] Starting Vite...');

// Override argv for Vite CLI
process.argv = [
  process.execPath,
  path.join(nmLink, 'vite', 'bin', 'vite.js'),
  '--port', '3000',
  '--strictPort',
  '--host', '0.0.0.0'
];

const viteBin = path.join(nmLink, 'vite', 'bin', 'vite.js');
await import(pathToFileURL(viteBin).href);
