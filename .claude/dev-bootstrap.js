const fs = require('fs');
const path = require('path');

const worktreeRoot = path.resolve(__dirname, '..');
const mainRepo = 'C:\\Dev\\plexifybid';

// Copy .env.local if needed
const envTarget = path.join(worktreeRoot, '.env.local');
const envSource = path.join(mainRepo, '.env.local');
if (!fs.existsSync(envTarget) && fs.existsSync(envSource)) {
  fs.copyFileSync(envSource, envTarget);
}

// Set NODE_PATH so all modules resolve from main repo
process.env.NODE_PATH = path.join(mainRepo, 'node_modules');
require('module').Module._initPaths();

// Load Vite from main repo
require(path.join(mainRepo, 'node_modules', 'vite', 'bin', 'vite.js'));
