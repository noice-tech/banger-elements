import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const types = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.tsx': 'text/plain',
	'.md': 'text/plain',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.wasm': 'application/wasm',
	'.woff2': 'font/woff2',
};
http
	.createServer(async (request, response) => {
		try {
			const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
			let file = path.resolve(
				root,
				`.${pathname.endsWith('/') ? pathname + 'index.html' : pathname}`,
			);
			if (!file.startsWith(root + path.sep)) {
				response.writeHead(403).end();
				return;
			}
			let data;
			try {
				data = await readFile(file);
			} catch (error) {
				if (path.extname(file)) throw error;
				file += '.html';
				data = await readFile(file);
			}
			response.writeHead(200, {
				'Content-Type': `${types[path.extname(file)] ?? 'application/octet-stream'}; charset=utf-8`,
				'Cache-Control': 'no-store',
			});
			response.end(data);
		} catch {
			response.writeHead(404).end('Not found. Run bun run build first.');
		}
	})
	.listen(Number(process.env.PORT ?? 3300), '127.0.0.1', function () {
		console.log(`Examples: http://localhost:${this.address().port}`);
	});
