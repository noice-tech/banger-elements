// First run bun run smoke. The maintained fixture uses only the hosted default
// audio and no artwork; never substitute local user media for these posters.
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {compositions} from '../../studio/src/fixtures/compositions.ts';
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(path.join(workspace, 'static/posters'), {recursive: true});
for (const {slug, id: name} of compositions) {
	if (!slug || (process.argv[2] && process.argv[2] !== slug)) continue;
	await sharp(path.resolve(workspace, `../../out/${name}.png`))
		.resize({width: 900, withoutEnlargement: true})
		.webp({quality: 85})
		.toFile(path.join(workspace, `static/posters/${slug}.webp`));
}
console.log('Updated posters from maintained generated-source smoke renders (frame 96, 60 FPS).');
