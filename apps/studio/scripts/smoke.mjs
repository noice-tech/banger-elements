import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compositions} from '../src/fixtures/compositions.ts';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = path.resolve(workspace, '../..');
const require = createRequire(import.meta.url);
const cli = path.join(
	path.dirname(require.resolve('@remotion/cli/package.json')),
	'remotion-cli.js',
);
const output = path.join(repository, 'out');
mkdirSync(output, {recursive: true});

for (const {id: composition} of compositions) {
	console.log(`Rendering ${composition}`);
	const result = spawnSync(
		process.execPath,
		[
			cli,
			'still',
			'src/fixtures/render-root.tsx',
			composition,
			path.join(output, `${composition}.png`),
			'--frame=96',
			'--gl=angle',
			'--log=error',
			`--public-dir=${path.join(repository, 'public')}`,
		],
		{cwd: workspace, stdio: 'inherit'},
	);
	if (result.status !== 0) process.exit(result.status ?? 1);
}
