// Render the clip under the home page's "From preview to project" code window
// from src/components/how/cover.tsx, plus the poster it shows while loading.
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
const out = path.join(workspace, 'static/how');
mkdirSync(out, {recursive: true});

// Four bars of the 122 BPM demo song at 30 FPS, starting just after its intro.
const FIRST = 165;
const LAST = FIRST + 236 - 1;
const render = (args) => {
	const result = spawnSync(
		process.execPath,
		[cli, ...args, `--gl=${process.env.REMOTION_GL ?? 'angle'}`, '--log=error'],
		{cwd: studio, stdio: 'inherit'},
	);
	if (result.status !== 0) process.exit(result.status ?? 1);
};
render([
	'render',
	'src/fixtures/render-root.tsx',
	'HowCover',
	path.join(out, 'cover.webm'),
	'--codec=vp9',
	`--frames=${FIRST}-${LAST}`,
	'--scale=0.75',
	'--crf=44',
	'--muted',
	// Halo's trails build on the previous frames, so render them in order.
	'--concurrency=1',
]);
const still = path.join(out, 'cover.png');
render([
	'still',
	'src/fixtures/render-root.tsx',
	'HowCover',
	still,
	`--frame=${FIRST}`,
	'--scale=0.75',
]);
await sharp(still).webp({quality: 82}).toFile(path.join(out, 'cover.webp'));
rmSync(still);
console.log('Updated static/how/cover.webm and cover.webp.');
