// Dependency-free static dev server. Runs identically on Windows (PowerShell),
// WSL, macOS, and inside a container -- unlike serve.sh, which needs bash.
//
//   node serve.mjs                 -> http://127.0.0.1:8000
//   node serve.mjs 4000            -> pick a port
//   node serve.mjs 8000 0.0.0.0    -> listen on all interfaces (needed in Docker)
//
// Binding defaults to 0.0.0.0 inside a container, because 127.0.0.1 there means
// "this container only" and the port would look dead from the host.

import { createServer } from 'node:http';
import { existsSync, createReadStream, statSync } from 'node:fs';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8000;
const IN_CONTAINER = existsSync('/.dockerenv');
const HOST = process.argv[3] || process.env.HOST || (IN_CONTAINER ? '0.0.0.0' : '127.0.0.1');

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
    let pathname;
    try {
        ({ pathname } = new URL(req.url, 'http://localhost'));
    } catch {
        res.writeHead(400).end('Bad request');
        return;
    }

    // decodeURIComponent matters here: the resume PDF has spaces in its name.
    let rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(ROOT, rel);

    // Never serve anything outside the repo, whatever the request looks like.
    if (!file.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end(`404 ${pathname}`);
        console.log(`404 ${pathname}`);
        return;
    }

    res.writeHead(200, {
        'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'content-length': statSync(file).size,
        // A dev server that caches is a dev server that lies to you.
        'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
    console.log(`200 ${pathname}`);
});

server.listen(PORT, HOST, () => {
    console.log(`\nServing ${ROOT}\n`);
    console.log(`  http://localhost:${PORT}`);
    if (HOST === '0.0.0.0') {
        for (const list of Object.values(networkInterfaces())) {
            for (const net of list || []) {
                if (net.family === 'IPv4' && !net.internal) {
                    console.log(`  http://${net.address}:${PORT}`);
                }
            }
        }
        if (IN_CONTAINER) {
            console.log(`\n  In a container: this only reaches your browser if the port was`);
            console.log(`  published at start time, e.g. docker run -p ${PORT}:${PORT} ...`);
        }
    }
    console.log('\nCtrl-C to stop.\n');
});
