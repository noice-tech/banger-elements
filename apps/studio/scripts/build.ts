import {mkdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(workspace, 'dist');
await rm(dist, {recursive: true, force: true});
await mkdir(dist, {recursive: true});
await build({
	entryPoints: [path.join(workspace, 'src/fixtures/render-root.tsx')],
	outfile: path.join(dist, 'render-root.js'),
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: 'es2022',
	jsx: 'automatic',
	define: {'process.env.NODE_ENV': '"production"'},
	legalComments: 'inline',
});
console.log('Bundled the maintained generated-source Studio fixture.');
