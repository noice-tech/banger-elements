import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = path.resolve(workspace, '../..');
const require = createRequire(import.meta.url);
const cli = path.join(
	path.dirname(require.resolve('@remotion/cli/package.json')),
	'remotion-cli.js',
);
// Run bun run build:elements first; exercise the delivered source, not a private copy.
const entryPoint = 'src/fixtures/vhs-regression-root.tsx';
const output = path.join(repository, 'out/vhs-regression');
const assets = path.join(output, 'assets');
mkdirSync(assets, {recursive: true});
// Synthetic silence only: no user media or network access needed by these fixtures.
const samples = 44100 * 6;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(44100, 24);
wav.writeUInt32LE(88200, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);
writeFileSync(path.join(assets, 'silence.wav'), wav);

const args = process.argv.slice(2);
const targets = args.length
	? [args[0]]
	: [
			'VhsSvg',
			'VhsWebgl',
			'VhsIsolation',
			'VhsSvg60',
			'VhsSingle',
			'VhsPlain',
			'VhsBypass',
			'VhsDelayed',
		];
for (const id of targets) {
	const frame = args[1] ?? (id === 'VhsDelayed' ? '63' : id.endsWith('60') ? '96' : '48');
	const result = spawnSync(
		process.execPath,
		[
			cli,
			'still',
			entryPoint,
			id,
			path.join(output, `${id}-${frame}.png`),
			`--frame=${frame}`,
			'--gl=angle',
			`--public-dir=${assets}`,
		],
		{cwd: workspace, stdio: 'inherit'},
	);
	if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!args.length) {
	for (const [a, b] of [
		['VhsSvg-48', 'VhsSvg60-96'],
		['VhsPlain-48', 'VhsBypass-48'],
		['VhsSingle-48', 'VhsDelayed-63'],
	]) {
		assert.deepEqual(
			readFileSync(path.join(output, `${a}.png`)),
			readFileSync(path.join(output, `${b}.png`)),
			`${a} must match ${b}`,
		);
		console.log(`Verified pixel-identical PNGs: ${a} / ${b}`);
	}
	for (const concurrency of [1, 4]) {
		const result = spawnSync(
			process.execPath,
			[
				cli,
				'render',
				entryPoint,
				'VhsSvg',
				path.join(output, `sequence-c${concurrency}`),
				'--sequence',
				'--image-format=png',
				'--frames=46-50',
				'--gl=angle',
				`--concurrency=${concurrency}`,
				`--public-dir=${assets}`,
				'--log=error',
			],
			{cwd: workspace, stdio: 'inherit'},
		);
		if (result.status !== 0) process.exit(result.status ?? 1);
	}
	for (let frame = 46; frame <= 50; frame++) {
		assert.deepEqual(
			readFileSync(path.join(output, `sequence-c1/element-${frame}.png`)),
			readFileSync(path.join(output, `sequence-c4/element-${frame}.png`)),
			`Concurrency mismatch at frame ${frame}`,
		);
	}
	assert.deepEqual(
		readFileSync(path.join(output, 'VhsSvg-48.png')),
		readFileSync(path.join(output, 'sequence-c1/element-48.png')),
		'Direct seek must match sequential rendering',
	);
	console.log('Verified sequential rendering, direct seek, and concurrency 1 / 4.');
}
