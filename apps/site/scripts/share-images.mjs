import {mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {compositions} from '../../studio/src/fixtures/compositions.ts';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(workspace, 'static/share');
const WIDTH = 1200;
const HEIGHT = 630;
const STAGE = '#080a10';
const PAD = 24;
const GAP = 8;

const catalog = JSON.parse(
	await readFile(path.join(workspace, '../../packages/elements/dist/catalog.json'), 'utf8'),
);
const render = (slug) => {
	const composition = compositions.find((entry) => entry.slug === slug);
	if (!composition) throw new Error(`No smoke fixture for ${slug}`);
	return path.resolve(workspace, `../../out/${composition.id}.png`);
};
const jpeg = (image, name) =>
	image
		.flatten({background: STAGE})
		.jpeg({quality: 82, mozjpeg: true})
		.toFile(path.join(out, `${name}.jpg`));

await mkdir(out, {recursive: true});

for (const {slug} of catalog) {
	const frame = await sharp(render(slug))
		.resize({width: WIDTH, height: HEIGHT, fit: 'contain', background: STAGE})
		.toBuffer();
	await jpeg(sharp(frame), slug);
}

const collage = async (slugs, columns, name) => {
	const rows = Math.ceil(slugs.length / columns);
	const tileWidth = Math.floor((WIDTH - 2 * PAD - (columns - 1) * GAP) / columns);
	const tileHeight = Math.round((tileWidth * 9) / 16);
	const gridHeight = rows * tileHeight + (rows - 1) * GAP;
	const top = Math.round((HEIGHT - gridHeight) / 2);
	const left = Math.round((WIDTH - (columns * tileWidth + (columns - 1) * GAP)) / 2);
	const tiles = await Promise.all(
		slugs.map(async (slug, index) => ({
			input: await sharp(render(slug))
				.flatten({background: STAGE})
				.resize({width: tileWidth, height: tileHeight, fit: 'cover'})
				.toBuffer(),
			left: left + (index % columns) * (tileWidth + GAP),
			top: top + Math.floor(index / columns) * (tileHeight + GAP),
		})),
	);
	await jpeg(
		sharp({create: {width: WIDTH, height: HEIGHT, channels: 3, background: '#07080c'}}).composite(
			tiles,
		),
		name,
	);
};

// EXTERNAL: Node can't import src/data/elements.ts, so this copies its elementCategories featured order.
const featured = {
	visualizers: ['ferrofluid', 'halo', 'spectre', 'circle', 'waveform', 'audio-particles'],
	shaders: ['pulse', 'cathedral', 'liquid', 'chrome', 'neuron', 'matrix'],
	effects: ['wet-glass', 'vhs', 'fisheye'],
};
const inCategory = (category) => {
	const slugs = catalog.filter((entry) => entry.category === category).map((entry) => entry.slug);
	return [...featured[category], ...slugs.filter((slug) => !featured[category].includes(slug))];
};
await collage(inCategory('visualizers').slice(0, 8), 4, 'visualizers');
await collage(inCategory('shaders').slice(0, 12), 4, 'shaders');
await collage(inCategory('effects'), 3, 'effects');
await collage(
	[
		...inCategory('visualizers').slice(0, 4),
		...inCategory('shaders').slice(0, 6),
		...inCategory('effects').slice(0, 2),
	],
	4,
	'site',
);
console.log('Updated Open Graph images in static/share from the frame 96 smoke renders.');
