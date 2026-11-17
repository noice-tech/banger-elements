import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {wrapDemos} from '../src/components/wrap/demos';

const workspace = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(
	readFileSync(path.join(workspace, '../../packages/elements/dist/catalog.json'), 'utf8'),
) as {slug: string; category: string}[];

test('"Wrap anything" shows every effect in the collection, rendered', () => {
	const effects = catalog
		.filter((entry) => entry.category === 'effects')
		.map((entry) => entry.slug);
	assert.deepEqual(wrapDemos.map((demo) => demo.slug).sort(), [...effects].sort());
	for (const demo of wrapDemos) {
		for (const file of [`${demo.slug}.webm`, `${demo.slug}.webp`]) {
			assert.ok(existsSync(path.join(workspace, 'static/wrap', file)), `npm run wrap ${demo.slug}`);
		}
	}
});
