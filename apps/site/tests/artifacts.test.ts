import assert from 'node:assert/strict';
import {readFile, readdir, access} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
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

test('static output excludes local audio and video uploads, except the generated preview clips', async () => {
	const files = await readdir(dist, {recursive: true});
	// scripts/clips.mjs cuts these from the hosted demo tracks; anything else is a stray upload.
	const clips = [
		...sceneTimings.map((timing) => sceneClip(timing).src.slice(1)),
		'audio/tuner.mp3',
	];
	const media = files.filter((file) => /\.(mp3|wav|mp4|mov|m4a)$/i.test(file));
	assert.deepEqual(media.map((file) => file.replaceAll('\\', '/')).sort(), clips.sort());
});
