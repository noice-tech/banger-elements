import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const turbo = path.join(path.dirname(require.resolve('turbo/package.json')), 'bin/turbo');
// Bun's inherited lifecycle environment can make nested Turbo tasks silently
// skip execution. Run with a clean package-manager environment and PATH.
const env = Object.fromEntries(
	Object.entries(process.env).filter(
		([key]) => !key.startsWith('npm_') && key !== 'NODE' && key !== '_',
	),
);
env.PATH = env.PATH?.split(path.delimiter)
	.filter((entry) => !entry.endsWith('node_modules/.bin'))
	.join(path.delimiter);
const result = spawnSync(process.execPath, [turbo, ...process.argv.slice(2)], {
	stdio: 'inherit',
	env,
});
process.exit(result.status ?? 1);
