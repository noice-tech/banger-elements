import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv.includes('--skip-build')) {
	const built = spawnSync(
		process.execPath,
		['scripts/turbo.mjs', 'run', 'build', '--filter=@banger-elements/collection'],
		{cwd: repository, stdio: 'inherit'},
	);
	if (built.status !== 0) process.exit(built.status ?? 1);
}
const require = createRequire(import.meta.url);
const cli = path.join(
	path.dirname(require.resolve('@remotion/cli/package.json')),
	'remotion-cli.js',
);
const studio = spawnSync(
	process.execPath,
	[cli, 'studio', 'src/fixtures/render-root.tsx', '--port=3001', '--public-dir=../../public'],
	{cwd: path.join(repository, 'apps/studio'), stdio: 'inherit'},
);
process.exit(studio.status ?? 1);
