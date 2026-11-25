import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const cli = path.join(
	path.dirname(require.resolve('@remotion/cli/package.json')),
	'remotion-cli.js',
);
const output = path.join(workspace, 'static/hero');
mkdirSync(output, {recursive: true});

const remotion = (args) => {
	const result = spawnSync(
		process.execPath,
		[
			cli,
			...args,
			'--public-dir=static',
			'--concurrency=1',
			'--log=error',
			`--gl=${process.env.REMOTION_GL ?? 'angle'}`,
		],
		{cwd: workspace, stdio: 'inherit'},
	);
	if (result.status !== 0) process.exit(result.status ?? 1);
};

const still = process.argv.find((arg) => arg.startsWith('--still='));
if (still) {
	const frame = still.slice('--still='.length);
	const props = process.argv.includes('--show-word') ? '{"showWord":true}' : '{}';
	const file =
		process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) ??
		path.join(tmpdir(), `hero-word-${frame}.png`);
	remotion([
		'still',
		'scripts/hero-word/root.tsx',
		'HeroWord',
		file,
		`--frame=${frame}`,
		`--props=${props}`,
	]);
} else {
	remotion([
		'render',
		'scripts/hero-word/root.tsx',
		'HeroWord',
		path.join(output, 'shape.webm'),
		'--codec=vp9',
		'--crf=36',
		'--muted',
	]);
	console.log('Updated static/hero/shape.webm.');
}
