// Zero-dependency dev server with live reload via Server-Sent Events.
// Usage: node serve.js   ->  http://localhost:5173

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.frag': 'text/plain',
  '.css': 'text/css', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.json': 'application/json',
};
const WATCHED = new Set(['shader.frag', 'main.js', 'index.html', 'tile.html', 'renderer.js', 'animate.js',
                         'pattern.frag', 'compare.js', 'compare.html', 'questions.md', 'sound.html', 'sound.js', 'playback.js']);

const clients = new Set();

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`tile sandbox: http://localhost:${PORT}`));

// Debounced file watching: editors often fire several events per save.
const pending = new Map();
fs.watch(ROOT, (_event, name) => {
  if (!name || !WATCHED.has(name)) return;
  clearTimeout(pending.get(name));
  pending.set(name, setTimeout(() => {
    pending.delete(name);
    console.log('changed:', name);
    for (const c of clients) c.write(`data: ${name}\n\n`);
  }, 50));
});
