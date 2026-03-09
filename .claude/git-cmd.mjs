import { execSync } from 'child_process';
const cmd = process.argv.slice(2).join(' ');
try {
  const out = execSync(cmd, { cwd: 'C:\\Dev\\plexifybid\\.claude\\worktrees\\sharp-mayer', encoding: 'utf8', env: { ...process.env, HOME: 'C:\\Users\\KensBOXX' } });
  process.stdout.write(out);
} catch (e) {
  process.stderr.write(e.stderr || e.message);
  process.exit(1);
}
