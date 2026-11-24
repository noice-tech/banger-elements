import assert from 'node:assert/strict';
import {readFile, readdir, access} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {ELEMENT_PAYLOAD_MIME_TYPE, StudioProtocolInternals} from '@remotion/studio-protocol';
import sharp from 'sharp';
import {recipes} from '../src/components/recipes/recipes';
import {sceneClip, sceneTimings} from '../src/components/scenes/timing';

const workspace = path.resolve(import.meta.dirname, '..');
const repository = path.resolve(workspace, '../..');
const dist = path.join(workspace, 'dist');
const producer = path.join(repository, 'packages/elements/dist');
const catalog = JSON.parse(await readFile(path.join(producer, 'catalog.json'), 'utf8')) as {
	slug: string;
	category: string;
}[];

test('site stages producer-owned artifacts byte-for-byte', async () => {
	for (const {slug} of catalog) {
		for (const [source, target] of [
			[`elements/${slug}.tsx`, `elements/${slug}.tsx`],
			[`payloads/${slug}.json`, `elements/${slug}.json`],
		]) {
			assert.deepEqual(
				await readFile(path.join(dist, target)),
				await readFile(path.join(producer, source)),
			);
		}
	}
});

test('each element page embeds only its own Studio payload, so `remotion elements use <url>` works', async () => {
	const scriptPattern = new RegExp(
		`<script type="${ELEMENT_PAYLOAD_MIME_TYPE.replace(/[.+]/g, '\\$&')}">([\\s\\S]*?)</script>`,
		'g',
	);
	for (const {slug} of catalog) {
		const html = await readFile(path.join(dist, `${slug}.html`), 'utf8');
		const scripts = [...html.matchAll(scriptPattern)];
		assert.equal(scripts.length, 1, `${slug}: one embedded payload`);
		const embedded = StudioProtocolInternals.parseStudioElementPayload(JSON.parse(scripts[0]![1]!));
		assert.ok(embedded, `${slug}: embedded payload is valid`);
		const staged = JSON.parse(
			await readFile(path.join(producer, `payloads/${slug}.json`), 'utf8'),
		) as Record<string, unknown>;
		const {sourceSettings, ...protocol} = staged;
		assert.ok(sourceSettings, `${slug}: staged payload keeps site-only source settings`);
		assert.deepEqual(JSON.parse(scripts[0]![1]!), protocol, `${slug}: matches the staged payload`);
	}
	// Galleries link to element pages instead of embedding every payload.
	for (const page of ['index', 'visualizers', 'shaders', 'effects']) {
		const html = await readFile(path.join(dist, `${page}.html`), 'utf8');
		assert.ok(!html.includes(ELEMENT_PAYLOAD_MIME_TYPE), `${page}: no embedded payloads`);
	}
});

test('every catalog entry has a downloadable detail page, poster and gallery preview', async () => {
	// The category pages are the complete galleries; the home overview only features some.
	const galleries = (
		await Promise.all(
			['visualizers', 'shaders', 'effects'].map((category) =>
				readFile(path.join(dist, `${category}.html`), 'utf8'),
			),
		)
	).join('\n');
	const overview = await readFile(path.join(dist, 'index.html'), 'utf8');
	for (const {slug} of catalog) {
		const html = await readFile(path.join(dist, `${slug}.html`), 'utf8');
		assert.ok(html.includes(`/elements/${slug}.tsx`), `${slug}: missing download`);
		assert.ok(
			html.includes(
				`https://github.com/noice-tech/banger-elements/blob/main/packages/elements/src/elements/${slug}/${slug}.tsx`,
			),
			`${slug}: missing GitHub source`,
		);
		assert.ok(galleries.includes(`/posters/${slug}.webp`), `${slug}: missing gallery poster`);
		assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${slug}: one page title`);
		assert.ok(galleries.includes(`/${slug}.html`), `${slug}: missing gallery link`);
		assert.ok(galleries.includes(`/previews/${slug}.webm`), `${slug}: missing preview`);
		const poster = await readFile(path.join(dist, `posters/${slug}.webp`));
		assert.equal(poster.toString('ascii', 8, 12), 'WEBP');
		const preview = await readFile(path.join(dist, `previews/${slug}.webm`));
		assert.deepEqual([...preview.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
	}
	assert.ok(!/<video[^>]*autoplay/.test(overview + galleries), 'Gallery must not force autoplay');
});

test('only Element pages advertise their own CLI install payload', async () => {
	const pages = new Map(catalog.map(({slug}) => [`${slug}.html`, `/elements/${slug}.json`]));
	for (const file of (await readdir(dist)).filter((name) => name.endsWith('.html'))) {
		const html = await readFile(path.join(dist, file), 'utf8');
		const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)?.[1] ?? '';
		const links =
			head.match(/<link\b[^>]*\btype="application\/vnd\.remotion\.element\+json"[^>]*>/g) ?? [];
		const payload = pages.get(file);
		assert.equal(links.length, payload ? 1 : 0, `${file}: wrong number of payload links`);
		if (payload) {
			assert.match(links[0]!, /\brel="alternate"/, file);
			assert.ok(links[0]!.includes(`href="${payload}"`), `${file}: wrong payload URL`);
		}
	}
});

test('categories: gallery and navigation group all elements without changing their URLs', async () => {
	const overview = await readFile(path.join(dist, 'index.html'), 'utf8');
	const sectionOf = (html: string, category: string) =>
		new RegExp(`<section[^>]*aria-labelledby="${category}"[^>]*>([\\s\\S]*?)</section>`).exec(
			html,
		)?.[1];
	for (const category of ['visualizers', 'shaders', 'effects']) {
		assert.ok(overview.includes(`href="/${category}"`), `${category}: missing category link`);
		// The overview features a few of each category and never lists another category's elements.
		const featured = sectionOf(overview, category);
		assert.ok(featured, `${category}: missing overview section`);
		assert.ok(featured.includes('href="/'), `${category}: features something`);
		// The category page lists exactly its elements.
		const page = sectionOf(await readFile(path.join(dist, `${category}.html`), 'utf8'), category);
		assert.ok(page, `${category}: missing gallery section`);
		for (const entry of catalog) {
			const inCategory = entry.category === category;
			assert.equal(page.includes(`href="/${entry.slug}.html"`), inCategory, `${category} page`);
			if (!inCategory)
				assert.ok(!featured.includes(`href="/${entry.slug}.html"`), `${category} overview`);
		}
	}
	const trip = await readFile(path.join(dist, 'trip.html'), 'utf8');
	assert.ok(trip.includes('href="/shaders"'));
	for (const slug of ['vhs', 'fisheye', 'wet-glass']) {
		const effect = await readFile(path.join(dist, `${slug}.html`), 'utf8');
		assert.ok(effect.includes('href="/effects"'));
		assert.ok(effect.includes('does not automatically wrap selected layers'));
		assert.ok(effect.includes('wrapper is empty until you add children'));
		assert.ok(!effect.includes('No props are required.'));
	}
});

test('static navigation, assets and fragment targets resolve without a backend', async () => {
	for (const file of (await readdir(dist)).filter((name) => name.endsWith('.html'))) {
		const html = await readFile(path.join(dist, file), 'utf8');
		for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
			const url = new URL(match[1]!, `http://site.test/${file}`);
			if (url.origin !== 'http://site.test') continue;
			let target = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
			if (!path.extname(target)) target += '.html';
			await access(path.join(dist, target));
			if (url.hash && target.endsWith('.html')) {
				const content = await readFile(path.join(dist, target), 'utf8');
				assert.ok(
					content.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
					`${file}: broken fragment ${url.href}`,
				);
			}
		}
	}
});

test('each example has its rendered assets and a play control, and only audible examples have a sound toggle', async () => {
	const html = await readFile(path.join(dist, 'examples.html'), 'utf8');
	for (const {id, silent} of recipes) {
		const card = new RegExp(`<article[^>]*id="${id}"[^>]*>([\\s\\S]*?)</article>`).exec(html)?.[1];
		assert.ok(card, id);
		assert.ok(card.includes('data-player-toggle'), id);
		assert.equal(card.includes('data-recipe-sound'), !silent, id);
		assert.ok(card.includes(`/recipes/${id}.webm`), id);
		assert.ok(card.includes(`/recipes/${id}.webp`), id);
		const clip = await readFile(path.join(dist, 'recipes', `${id}.webm`));
		const poster = await readFile(path.join(dist, 'recipes', `${id}.webp`));
		assert.deepEqual([...clip.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], id);
		assert.equal(poster.toString('ascii', 8, 12), 'WEBP', id);
	}
});

test('the home page plays one example and links to the rest with small icons', async () => {
	const home = await readFile(path.join(dist, 'index.html'), 'utf8');
	const section = /<section[^>]*aria-labelledby="examples-title"[^>]*>([\s\S]*?)<\/section>/.exec(
		home,
	)?.[1];
	assert.ok(section);
	assert.ok(section.includes('href="/examples.html"'));
	const played = recipes.filter(({id}) => section.includes(`/recipes/${id}.webm`));
	assert.equal(played.length, 1);
	for (const {id} of recipes.filter((recipe) => !played.includes(recipe))) {
		assert.ok(section.includes(`/recipes/icons/${id}.webp`), id);
		const icon = await readFile(path.join(dist, 'recipes/icons', `${id}.webp`));
		const poster = await readFile(path.join(dist, 'recipes', `${id}.webp`));
		assert.equal(icon.toString('ascii', 8, 12), 'WEBP', id);
		assert.ok(icon.length < poster.length, `${id}: icons/ comes from scripts/recipes.mjs`);
	}
});

test('static output includes only the intentional demo audio and video assets', async () => {
	const files = await readdir(dist, {recursive: true});
	const clips = [
		...sceneTimings.map((timing) => sceneClip(timing).src.slice(1)),
		...new Set(recipes.flatMap(({audioFile}) => (audioFile ? [audioFile] : []))),
		'audio/tuner.mp3',
	];
	const media = files.filter((file) => /\.(mp3|wav|mp4|mov|m4a)$/i.test(file));
	assert.deepEqual(media.map((file) => file.replaceAll('\\', '/')).sort(), clips.sort());
});

test('every page has a 1200x630 share image and an extensionless canonical URL', async () => {
	const site = 'https://banger-elements.dev';
	for (const file of (await readdir(dist)).filter((name) => name.endsWith('.html'))) {
		if (file === '404.html') continue;
		const html = await readFile(path.join(dist, file), 'utf8');
		const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
		assert.ok(image, `${file}: og:image`);
		assert.ok(image.startsWith(`${site}/share/`), `${file}: og:image`);
		const {width, height, format} = await sharp(
			path.join(dist, new URL(image).pathname.slice(1)),
		).metadata();
		assert.deepEqual([width, height, format], [1200, 630, 'jpeg'], file);
		const page = file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`;
		assert.match(html, new RegExp(`<link rel="canonical" href="${site}${page}"\\s?/?>`), file);
		if (catalog.some(({slug}) => `${slug}.html` === file))
			assert.equal(image, `${site}/share/${file.replace(/\.html$/, '')}.jpg`, file);
	}
});

test('coding agents get a Markdown index and a Markdown twin of every page', async () => {
	const site = 'https://banger-elements.dev';
	const llms = await readFile(path.join(dist, 'llms.txt'), 'utf8');
	assert.equal(await readFile(path.join(dist, 'index.md'), 'utf8'), llms);
	for (const {slug} of catalog) {
		const html = await readFile(path.join(dist, `${slug}.html`), 'utf8');
		assert.match(html, new RegExp(`<link rel="alternate" type="text/markdown" href="/${slug}.md"`));
		const markdown = await readFile(path.join(dist, `${slug}.md`), 'utf8');
		// Remotion's /remotion-elements skill installs from the page URL named near the top.
		assert.ok(markdown.includes(`\nElement page: ${site}/${slug}\n`), slug);
		assert.ok(markdown.includes(`npx remotion elements use ${site}/${slug} `), slug);
		assert.ok(markdown.includes('| Prop | Type | Default |'), slug);
		assert.ok(llms.includes(`](${site}/${slug}.md)`), `${slug}: listed in llms.txt`);
	}
	const guide = await readFile(path.join(dist, 'getting-started.md'), 'utf8');
	assert.ok(guide.startsWith('# Getting started\n'));
	assert.ok(!guide.includes('](/'), 'guide links are absolute');
	// Every link to this site from the Markdown files resolves to a built file.
	const markdownFiles = (await readdir(dist)).filter((name) => name.endsWith('.md'));
	for (const file of [...markdownFiles, 'llms.txt']) {
		const text = await readFile(path.join(dist, file), 'utf8');
		for (const [, href] of text.matchAll(/\]\((https:\/\/banger-elements\.dev[^)\s#]*)/g)) {
			let target = new URL(href!).pathname.slice(1) || 'index.html';
			if (!path.extname(target)) target += '.html';
			await access(path.join(dist, target));
		}
	}
});
