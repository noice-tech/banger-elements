// Render comparison clips and posters. Usage: node scripts/wrap.mjs [slug,...]
import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {wrapDemos} from '../src/components/wrap/demos.ts';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studio = path.resolve(workspace, '../studio');
const require = createRequire(import.meta.url);
const cli = path.join(
	path.dirname(require.resolve('@remotion/cli/package.json')),
	'remotion-cli.js',
);
const out = path.join(workspace, 'static/wrap');
mkdirSync(out, {recursive: true});

const only = process.argv[2]?.split(',');
/** A frame where every demo has settled: rain on the glass, type mid-scroll. */
const POSTER_FRAME = 40;

const render = (args) => {
	const result = spawnSync(
		process.execPath,
		[
			cli,
			...args,
			`--public-dir=${path.join(workspace, 'static')}`,
			`--gl=${process.env.REMOTION_GL ?? 'angle'}`,
			'--scale=0.75',
			'--log=error',
		],
		{cwd: studio, stdio: 'inherit'},
	);
	if (result.status !== 0) process.exit(result.status ?? 1);
};

for (const demo of wrapDemos) {
	if (only && !only.includes(demo.slug)) continue;
	const id = `Wrap-${demo.slug}`;
	render([
		'render',
		'src/fixtures/render-root.tsx',
		id,
		path.join(out, `${demo.slug}.webm`),
		'--codec=vp9',
		'--crf=52',
		'--muted',
	]);
	const still = path.join(out, `${demo.slug}.png`);
	render(['still', 'src/fixtures/render-root.tsx', id, still, `--frame=${POSTER_FRAME}`]);
	await sharp(still)
		.webp({quality: 80})
		.toFile(path.join(out, `${demo.slug}.webp`));
	rmSync(still);
	console.log(`Rendered ${demo.slug}.`);
}
