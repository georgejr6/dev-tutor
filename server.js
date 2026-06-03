const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Load .env if present (local dev)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join('=').trim();
    }
  });
}

// Fallback: read from video-clipper .env (local only)
if (!process.env.ANTHROPIC_API_KEY) {
  const fallback = path.join(__dirname, '..', 'video-clipper', '.env');
  if (fs.existsSync(fallback)) {
    fs.readFileSync(fallback, 'utf8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim();
      }
    });
  }
}

const KEY  = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3131;

if (!KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not found');
  process.exit(1);
}

function proxyToAnthropic(body, res) {
  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    },
  };

  const req = https.request(options, apiRes => {
    res.writeHead(apiRes.statusCode, { 'content-type': 'application/json' });
    apiRes.pipe(res);
  });

  req.on('error', err => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: err.message } }));
  });

  req.write(body);
  req.end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lesson') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => proxyToAnthropic(body, res));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`\n  Dev Tutor → http://localhost:${PORT}\n`);
});
