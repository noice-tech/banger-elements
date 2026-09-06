import {rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = [
	'packages/elements/dist',
	'apps/site/dist',
	'apps/site/.astro',
	'.turbo',
	'packages/elements/.turbo',
	'apps/site/.turbo',
	'apps/studio/.turbo',
	'out',
];
await Promise.all(
	generated.map((entry) => rm(path.join(repository, entry), {recursive: true, force: true})),
);
console.log(`Removed ${generated.join(', ')}.`);
