// Wraps src/game.html (a page fragment) into a full document at www/index.html, syntax-checks every
// inline script, and writes the home-screen app files (manifest, service worker, icons).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const body = fs.readFileSync(path.join(root, 'src', 'game.html'), 'utf8');
const pkg = require(path.join(root, 'package.json'));

const scripts = [...body.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
scripts.forEach((m, i) => { new vm.Script(m[1], { filename: `inline-script-${i}.js` }); });

const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0a1424">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Boot Camp">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>
</head>
<body>
${body}
<script>
if (!window.Capacitor && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>
</body>
</html>
`;

const manifest = {
  name: 'Boot Camp Commander', short_name: 'Boot Camp', start_url: './', scope: './',
  display: 'standalone', orientation: 'portrait', background_color: '#0a1424', theme_color: '#0a1424',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
};

// Network-first for the page (so updates arrive), cache fallback offline; cache-first for everything else.
const sw = `const CACHE = 'bootcamp-${pkg.version}-${Date.now()}';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
});
`;

fs.mkdirSync(www, { recursive: true });
fs.writeFileSync(path.join(www, 'index.html'), doc);
fs.writeFileSync(path.join(www, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(www, 'sw.js'), sw);
fs.writeFileSync(path.join(www, '.nojekyll'), '');
require('./icons.js');
console.log(`Built www/ (${scripts.length} scripts syntax-checked)`);
