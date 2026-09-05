import {spawn, spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = spawnSync(process.execPath, ['scripts/turbo.mjs', 'run', 'build'], {
	cwd: repository,
	stdio: 'inherit',
});
if (built.status !== 0) process.exit(built.status ?? 1);

const children = [
	spawn(process.execPath, ['scripts/serve.mjs'], {
		cwd: path.join(repository, 'apps/site'),
		stdio: 'inherit',
	}),
	spawn(process.execPath, ['scripts/studio.mjs', '--skip-build'], {
		cwd: repository,
		stdio: 'inherit',
	}),
];
let stopping = false;
const stop = (code = 0) => {
	if (stopping) return;
	stopping = true;
	children.forEach((child) => child.kill('SIGTERM'));
	process.exitCode = code;
};
children.forEach((child) => {
	child.on('exit', (code) => stop(code ?? 1));
	child.on('error', () => stop(1));
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
