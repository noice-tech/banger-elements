import {copyFile, mkdir, readFile, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const producerDist = path.resolve(workspace, '../../packages/elements/dist');
const dist = path.join(workspace, 'dist');
const catalog = JSON.parse(await readFile(path.join(producerDist, 'catalog.json'), 'utf8')) as {
	slug: string;
}[];
await rm(dist, {recursive: true, force: true});
const require = createRequire(import.meta.url);
const result = spawnSync(
	process.execPath,
	[path.join(path.dirname(require.resolve('astro/package.json')), 'astro.js'), 'build'],
	{cwd: workspace, stdio: 'inherit'},
);
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir(path.join(dist, 'elements'), {recursive: true});
for (const {slug} of catalog) {
	await copyFile(
		path.join(producerDist, 'elements', `${slug}.tsx`),
		path.join(dist, 'elements', `${slug}.tsx`),
	);
	await copyFile(
		path.join(producerDist, 'payloads', `${slug}.json`),
		path.join(dist, 'elements', `${slug}.json`),
	);
}

console.log('Built static showcase in apps/site/dist.');
