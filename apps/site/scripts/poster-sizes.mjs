// Derive the small poster sizes from static/posters/*.webp. Usage: node scripts/poster-sizes.mjs
// thumbs/ (448 px) serve the 224 px filmstrip on high-density screens; icons/ (96 px) serve the
// 28-32 px chips. Full posters stay for tiles and element pages, so nothing small loads a big file.
import {mkdir, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const posters = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../static/posters');
const sizes = [
	{dir: 'thumbs', width: 448, quality: 70},
	{dir: 'icons', width: 96, quality: 65},
];
for (const {dir} of sizes) await mkdir(path.join(posters, dir), {recursive: true});
const files = (await readdir(posters)).filter((file) => file.endsWith('.webp'));
for (const file of files) {
	for (const {dir, width, quality} of sizes) {
		await sharp(path.join(posters, file))
			.resize({width, withoutEnlargement: true})
			.webp({quality})
			.toFile(path.join(posters, dir, file));
	}
}
console.log(`Wrote thumbs and icons for ${files.length} posters.`);
