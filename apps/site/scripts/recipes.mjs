// Render the curated compositions on /examples from src/components/recipes,
// with sound, plus a poster for each. usage: node scripts/recipes.mjs [id,...]
import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {recipes} from '../src/components/recipes/recipes.ts';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studio = path.resolve(workspace, '../studio');
const require = createRequire(import.meta.url);
const cli = path.join(
	path.dirname(require.resolve('@remotion/cli/package.json')),
	'remotion-cli.js',
);
const out = path.join(workspace, 'static/recipes');
mkdirSync(out, {recursive: true});

const only = process.argv[2]?.split(',');

const render = (args) => {
	const result = spawnSync(
		process.execPath,
		[
			cli,
			...args,
			`--public-dir=${path.join(workspace, 'static')}`,
			`--gl=${process.env.REMOTION_GL ?? 'angle'}`,
			'--log=error',
		],
		{cwd: studio, stdio: 'inherit'},
	);
	if (result.status !== 0) process.exit(result.status ?? 1);
};

for (const recipe of recipes) {
	if (only && !only.includes(recipe.id)) continue;
	render([
		'render',
		'src/fixtures/render-root.tsx',
		recipe.component,
		path.join(out, `${recipe.id}.webm`),
		'--codec=vp9',
		`--scale=${recipe.scale}`,
		`--crf=${recipe.crf ?? 44}`,
		'--audio-bitrate=128k',
		// More tabs than this starve each other of the software GPU and the audio fetch.
		'--concurrency=4',
	]);
	const still = path.join(out, `${recipe.id}.png`);
	render([
		'still',
		'src/fixtures/render-root.tsx',
		recipe.component,
		still,
		`--frame=${recipe.poster}`,
		`--scale=${recipe.scale}`,
	]);
	await sharp(still)
		.webp({quality: 80})
		.toFile(path.join(out, `${recipe.id}.webp`));
	rmSync(still);
	console.log(`Rendered ${recipe.id}.`);
}
