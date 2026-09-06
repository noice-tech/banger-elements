import assert from 'node:assert/strict';
import {readFile, readdir, access} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const workspace = path.resolve(import.meta.dirname, '..');
const repository = path.resolve(workspace, '../..');
const catalog = JSON.parse(
	await readFile(path.join(repository, 'packages/elements/dist/catalog.json'), 'utf8'),
) as {slug: string}[];

test('site stages producer-owned artifacts byte-for-byte', async () => {
	for (const {slug} of catalog) {
		const [producerSource, servedSource, producerPayload, servedPayload] = await Promise.all([
			readFile(path.join(repository, `packages/elements/dist/elements/${slug}.tsx`)),
			readFile(path.join(workspace, `dist/elements/${slug}.tsx`)),
			readFile(path.join(repository, `packages/elements/dist/payloads/${slug}.json`)),
			readFile(path.join(workspace, `dist/elements/${slug}.json`)),
		]);
		assert.deepEqual(servedSource, producerSource);
		assert.deepEqual(servedPayload, producerPayload);
	}
	assert.deepEqual(
		await readFile(path.join(workspace, 'dist/NOTICE.md')),
		await readFile(path.join(repository, 'NOTICE.md')),
	);
});

test('all catalog detail pages contain static docs, downloads and real posters', async () => {
	for (const {slug} of catalog) {
		const html = await readFile(path.join(workspace, `dist/${slug}.html`), 'utf8');
		for (const text of [
			'Basic usage',
			'Key controls',
			'Before you render',
			`/elements/${slug}.tsx`,
			`/posters/${slug}.webp`,
			'StudioActions',
			'Preview',
			`${slug}-preview-controls`,
		]) {
			assert.ok(html.includes(text), `${slug}: missing ${text}`);
		}
		assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${slug}: one page title`);
		assert.ok(html.includes('banger Elements home'));
		assert.ok(html.includes('class="element-nav-list"'));
		assert.ok(html.includes(`href="/${slug}.html" aria-current="page"`));
		assert.ok(html.includes('Installs original source defaults, not preview changes.'));
		const poster = await readFile(path.join(workspace, `dist/posters/${slug}.webp`));
		assert.equal(poster.toString('ascii', 8, 12), 'WEBP');
	}
	const overview = await readFile(path.join(workspace, 'dist/index.html'), 'utf8');
	assert.equal((overview.match(/class="element-card"/g) ?? []).length, catalog.length);
	assert.equal((overview.match(/<video /g) ?? []).length, catalog.length);
	assert.ok(overview.includes('Halo'));
	assert.equal((overview.match(/<h1\b/g) ?? []).length, 1);
	assert.ok(!overview.includes('Seven audio-reactive'));
	assert.ok(!overview.includes('01—07'));
	assert.equal((overview.match(/poster="\/posters\//g) ?? []).length, catalog.length);
	assert.ok(
		!/<img[^>]+src="\/posters\//.test(overview),
		'No sidebar thumbnails or image layer beneath transparent videos',
	);
	assert.ok(overview.includes('Browse collection'));
	assert.ok(!overview.includes('MAKE IT YOURS'));
	assert.ok(overview.includes('Hide sidebar'));
	assert.ok(
		!/<video[^>]*autoplay/.test(overview),
		'Gallery playback must respect motion and visibility',
	);
	assert.ok(!overview.includes('Spectrum Halo'));
	assert.ok(!/component-url="[^"]*\/Preview\./.test(overview), 'Gallery must not mount Players');
	for (const {slug} of catalog) {
		assert.ok(overview.includes(`/previews/${slug}.webm`));
		const preview = await readFile(path.join(workspace, `dist/previews/${slug}.webm`));
		assert.deepEqual([...preview.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
	}
});

test('static navigation, assets and fragment targets resolve without a backend', async () => {
	const dist = path.join(workspace, 'dist');
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

test('static output excludes local media and retains preview playback contract', async () => {
	const files = await readdir(path.join(workspace, 'dist'), {recursive: true});
	assert.ok(!files.some((file) => /\.(mp3|wav|mp4|mov|m4a)$/i.test(file)));
	const preview = await readFile(path.join(workspace, 'src/components/Preview.tsx'), 'utf8');
	assert.ok(preview.includes('packages/elements/dist/components'));
	assert.ok(preview.includes('<AudioParticles'));
	assert.ok(preview.includes('playAudio={false}'));
	assert.ok(preview.includes('maskHalo'));
	assert.ok(preview.includes('<Player'));
	assert.ok(!preview.includes('Load interactive preview'));
	assert.ok(preview.includes('type="file"'));
	assert.ok(preview.includes('URL.createObjectURL'));
	assert.ok(preview.includes('createPortal'));
	assert.ok(preview.includes('const PREVIEW_WIDTH = 1280'));
	assert.ok(preview.includes('const PREVIEW_HEIGHT = 720'));
	assert.ok(
		preview.includes('preview-block not-content'),
		'Docs CSS must not leak into Player rendering',
	);
	assert.ok(!preview.includes('autoPlay'));
});

test('getting started describes the website-to-Studio visitor flow, not repository setup', async () => {
	const html = await readFile(path.join(workspace, 'dist/getting-started.html'), 'utf8');
	assert.ok(html.includes('Open your Remotion project'));
	assert.ok(html.includes('Install in Studio'));
	assert.ok(html.includes('Review and confirm in Studio'));
	assert.ok(!html.includes('bun install'));
	assert.ok(!html.includes('bun run dev'));
	assert.ok(!html.includes('localhost:3001'));
	assert.ok(!html.includes('fixture composition'));
	assert.ok(!html.includes('frame-ancestors'));
});
