import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = path.resolve(workspace, '../..');
const studio = path.join(repository, 'apps/studio');
const require = createRequire(import.meta.url);
const cli = path.join(
	path.dirname(require.resolve('@remotion/cli/package.json')),
	'remotion-cli.js',
);
const out = path.join(workspace, 'static/reel');
mkdirSync(out, {recursive: true});

// A frame from the Liquid × Ferrofluid scene, on a kick.
const POSTER_FRAME = 919;
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
render([
	'render',
	'src/fixtures/render-root.tsx',
	'Reel',
	path.join(out, 'reel.webm'),
	'--codec=vp9',
	'--scale=0.75',
	'--crf=48',
	'--audio-bitrate=128k',
	// Halo's trails build on the previous frames, so render them in order.
	'--concurrency=1',
]);
const still = path.join(out, 'reel.png');
render([
	'still',
	'src/fixtures/render-root.tsx',
	'Reel',
	still,
	`--frame=${POSTER_FRAME}`,
	'--scale=0.75',
]);
await sharp(still).webp({quality: 80}).toFile(path.join(out, 'reel.webp'));
rmSync(still);
console.log('Updated static/reel/reel.webm and reel.webp.');
