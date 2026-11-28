import {spawnSync} from 'node:child_process';
import {
	copyFile,
	cp,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	rmdir,
	writeFile,
} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {elementCategories, elements} from '../src/data/elements';
import {SITE} from '../src/lib/site';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const producerDist = path.resolve(workspace, '../../packages/elements/dist');
const build = path.join(workspace, 'build');
const dist = path.join(workspace, 'dist');
const catalog = JSON.parse(await readFile(path.join(producerDist, 'catalog.json'), 'utf8')) as {
	slug: string;
}[];

await rm(build, {recursive: true, force: true});
await rm(dist, {recursive: true, force: true});
const cli = path.join(
	path.dirname(createRequire(import.meta.url).resolve('@react-router/dev/package.json')),
	'bin.cjs',
);
const result = spawnSync(process.execPath, [cli, 'build'], {cwd: workspace, stdio: 'inherit'});
if (result.status !== 0) process.exit(result.status ?? 1);
await cp(path.join(build, 'client'), dist, {recursive: true});
await rm(build, {recursive: true, force: true});

const flatten = async (directory: string) => {
	for (const entry of await readdir(directory, {withFileTypes: true})) {
		if (!entry.isDirectory()) continue;
		const child = path.join(directory, entry.name);
		await flatten(child);
		const page = path.join(child, 'index.html');
		const files = await readdir(child);
		if (!files.includes('index.html')) continue;
		await rename(page, `${child}.html`);
		if (files.length === 1) await rmdir(child);
	}
};
await flatten(dist);
await rm(path.join(dist, '__spa-fallback.html'), {force: true});

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

const moved = [
	...elements.flatMap(({slug}) => [
		[`/${slug}`, `/elements/${slug}`],
		[`/${slug}.html`, `/elements/${slug}`],
		[`/${slug}.md`, `/elements/${slug}.md`],
	]),
	['/examples.html', '/examples'],
	['/getting-started.html', '/getting-started'],
	...elementCategories.map(({id}) => [`/${id}.html`, `/${id}`]),
];
await writeFile(
	path.join(dist, '_redirects'),
	moved.map(([from, to]) => `${from} ${to} 301`).join('\n') + '\n',
);

const pages = [
	'/',
	...elementCategories.map(({id}) => `/${id}`),
	...elements.map(({slug}) => `/elements/${slug}`),
	'/examples',
	'/getting-started',
];
await writeFile(
	path.join(dist, 'sitemap.xml'),
	`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
		.map((page) => `<url><loc>${new URL(page, SITE).href}</loc></url>`)
		.join('\n')}\n</urlset>\n`,
);

console.log('Built static showcase in apps/site/dist.');
