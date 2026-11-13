// Wraps src/game.html (a page fragment) into a full document at www/index.html for Capacitor,
// and syntax-checks every inline script.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const body = fs.readFileSync(path.join(root, 'src', 'game.html'), 'utf8');

const scripts = [...body.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
scripts.forEach((m, i) => { new vm.Script(m[1], { filename: `inline-script-${i}.js` }); });

const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0a1424">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.mkdirSync(path.join(root, 'www'), { recursive: true });
fs.writeFileSync(path.join(root, 'www', 'index.html'), doc);
console.log(`Built www/index.html (${scripts.length} scripts syntax-checked)`);
