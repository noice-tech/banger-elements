// Prerender the seven lightweight, silent loops used by the overview cards.
// The checked-in WebP posters remain the loading, error and reduced-motion fallback.
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = path.resolve(workspace, '../..');
const studio = path.join(repository, 'apps/studio');
const require = createRequire(import.meta.url);
const cli = path.join(
	path.dirname(require.resolve('@remotion/cli/package.json')),
	'remotion-cli.js',
);
const previews = path.join(workspace, 'static/previews');
const compositions = {
	waveform: 'Waveform',
	spectre: 'Spectre',
	oscilloscope: 'Oscilloscope',
	pulsar: 'Pulsar',
	circle: 'Circle',
	halo: 'Halo',
	'audio-particles': 'AudioParticles',
};

mkdirSync(previews, {recursive: true});
for (const [slug, composition] of Object.entries(compositions)) {
	console.log(`Rendering overview preview: ${composition}`);
	const result = spawnSync(
		process.execPath,
		[
			cli,
			'render',
			'src/fixtures/render-root.tsx',
			composition,
			path.join(previews, `${slug}.webm`),
			'--codec=vp9',
			'--pixel-format=yuva420p',
			'--image-format=png',
			'--frames=0-119',
			'--fps=30',
			'--scale=0.5',
			'--crf=36',
			'--muted',
			'--gl=angle',
			'--concurrency=1',
			'--log=error',
			`--public-dir=${path.join(repository, 'public')}`,
		],
		{cwd: studio, stdio: 'inherit'},
	);
	if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Updated overview WebM previews (4 seconds, 30 FPS).');
