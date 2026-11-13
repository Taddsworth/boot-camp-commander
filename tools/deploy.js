// Builds the game and publishes www/ to the gh-pages branch (GitHub Pages).
// Players keep their saves: progress lives in their browser under a fixed key on the same site.
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const root = path.join(__dirname, '..');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd: cwd || root, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

require('./build.js');
const remote = run('git', ['remote', 'get-url', 'origin']);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bootcamp-pages-'));
fs.cpSync(path.join(root, 'www'), tmp, { recursive: true });
run('git', ['init', '-q', '-b', 'gh-pages'], tmp);
run('git', ['add', '-A'], tmp);
run('git', ['-c', 'user.name=deploy', '-c', 'user.email=deploy@localhost', 'commit', '-q', '-m', 'Deploy ' + new Date().toISOString()], tmp);
run('git', ['push', '-q', '-f', remote, 'gh-pages'], tmp);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Deployed. Live within a minute or two at the GitHub Pages URL.');
