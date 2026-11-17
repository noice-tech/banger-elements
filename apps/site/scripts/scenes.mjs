// Prepare the home page scenes (src/components/scenes): a waveform of each
// scene's stretch of its track, and a poster plus picker thumbnail rendered
// from the scene as it ships. usage: node scripts/scenes.mjs [id,...]
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
// Node strips the types from this plain-data module.
import {
	SCENE_POSTER_FRAME,
	barSeconds,
	SCENE_BARS,
	sceneStart,
	sceneTimings,
	tracks,
} from '../src/components/scenes/timing.ts';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studio = path.resolve(workspace, '../studio');
const require = createRequire(import.meta.url);
const cli = path.join(
	path.dirname(require.resolve('@remotion/cli/package.json')),
	'remotion-cli.js',
);
const out = path.join(workspace, 'static/scenes');
const wavesFile = path.join(workspace, 'src/components/scenes/waves.json');
mkdirSync(path.join(out, 'thumbs'), {recursive: true});

const only = process.argv[2]?.split(',');
const SLICES = 256;
const RATE = 8000;

/** Loudness of the scene's stretch in SLICES slices, scaled so the loudest is 1. */
const levelsOf = (timing) => {
	const track = tracks[timing.track];
	const seconds = SCENE_BARS * barSeconds(track);
	const result = spawnSync(
		'ffmpeg',
		[
			...['-loglevel', 'error', '-ss', String(sceneStart(timing)), '-t', String(seconds)],
			...['-i', track.src, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'],
		],
		{maxBuffer: 64 * 1024 * 1024},
	);
	if (result.status !== 0) throw new Error(`ffmpeg failed for ${timing.id}`);
	const samples = new Float32Array(
		result.stdout.buffer,
		result.stdout.byteOffset,
		result.stdout.byteLength / 4,
	);
	const size = Math.floor(samples.length / SLICES);
	const levels = Array.from({length: SLICES}, (_, slice) => {
		let sum = 0;
		for (let i = slice * size; i < (slice + 1) * size; i++) sum += samples[i] ** 2;
		return Math.sqrt(sum / size);
	});
	const loudest = Math.max(...levels) || 1;
	return levels.map((level) => Math.round((level / loudest) * 1000) / 1000);
};

const render = (args) => {
	const result = spawnSync(
		process.execPath,
		[
			cli,
			...args,
			// The scenes set their type in Geist, loaded with staticFile().
			`--public-dir=${path.join(workspace, 'static')}`,
			`--gl=${process.env.REMOTION_GL ?? 'angle'}`,
			'--log=error',
		],
		{cwd: studio, stdio: 'inherit'},
	);
	if (result.status !== 0) process.exit(result.status ?? 1);
};

// Keep the other scenes' waveforms when only some are prepared.
const waves = existsSync(wavesFile) ? JSON.parse(readFileSync(wavesFile, 'utf8')) : {};

for (const timing of sceneTimings) {
	if (only && !only.includes(timing.id)) continue;
	waves[timing.id] = levelsOf(timing);
	const still = path.join(out, `${timing.id}.png`);
	render([
		'still',
		'src/fixtures/render-root.tsx',
		timing.component,
		still,
		`--frame=${SCENE_POSTER_FRAME}`,
	]);
	await sharp(still)
		.webp({quality: 80})
		.toFile(path.join(out, `${timing.id}.webp`));
	await sharp(still)
		.resize(96, 54)
		.webp({quality: 80})
		.toFile(path.join(out, 'thumbs', `${timing.id}.webp`));
	rmSync(still);
	console.log(`Prepared ${timing.id}.`);
}

const ordered = Object.fromEntries(
	sceneTimings.filter((timing) => waves[timing.id]).map((timing) => [timing.id, waves[timing.id]]),
);
writeFileSync(wavesFile, `${JSON.stringify(ordered)}\n`);
