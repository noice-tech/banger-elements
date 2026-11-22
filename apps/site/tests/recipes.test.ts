import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import catalog from '../../../packages/elements/dist/catalog.json';
import {highlightCode} from '../src/components/highlight';
import {recipes} from '../src/components/recipes/recipes';

const source = (id: string) =>
	readFileSync(new URL(`../src/components/recipes/${id}.tsx`, import.meta.url), 'utf8');
const slugOf = new Map(catalog.map((entry) => [entry.name, entry.slug]));

test('every recipe exports its composition component', () => {
	for (const recipe of recipes) {
		assert.match(source(recipe.id), new RegExp(`export const ${recipe.component} = `), recipe.id);
	}
	assert.equal(new Set(recipes.map((recipe) => recipe.id)).size, recipes.length);
});

test('each recipe poster is a frame within its composition', () => {
	for (const {id, poster, durationInFrames} of recipes) {
		assert.ok(Number.isInteger(poster) && poster >= 0 && poster < durationInFrames, id);
	}
});

test('the listed layers are exactly the elements a recipe imports', () => {
	for (const recipe of recipes) {
		const imported = source(recipe.id).match(
			/import \{([^}]+)\} from '[^']*elements\/dist\/components'/,
		);
		assert.ok(imported, `${recipe.id} imports from the collection`);
		const slugs = imported[1]!.split(',').map((name) => slugOf.get(name.trim()));
		assert.deepEqual([...slugs].sort(), [...recipe.layers].sort(), recipe.id);
	}
});

test('one layer plays the audio, except in silent recipes', () => {
	for (const {id, layers, silent} of recipes) {
		const code = source(id);
		const enabled = code.match(/\bplayAudio\b(?=\s|=\{true\})(?!\s*:)/g) ?? [];
		assert.equal(enabled.length, silent ? 0 : 1, id);
		if (silent || layers.length > 1) {
			assert.match(code, /playAudio(?:: false|=\{false\})/, id);
		}
	}
});

test('the highlighter escapes the source it colors', () => {
	const html = highlightCode(`<Halo playAudio title="a & b" />\n// <script>`);
	assert.ok(!html.includes('<Halo') && !html.includes('<script>'));
	assert.ok(html.includes('&lt;<span class="tc">Halo</span>'));
	assert.ok(html.includes('<span class="tp">playAudio</span>'));
	assert.ok(html.includes('&amp;'));
	assert.ok(html.includes('<span class="tm">// &lt;script&gt;</span>'));
});
