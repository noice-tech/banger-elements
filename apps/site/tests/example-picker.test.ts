import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ExamplePicker from '../src/components/ExamplePicker';
import {exampleGroups, examplePresets} from '../src/data/example-presets';

test('all examples are selectable with exactly one selected', () => {
	const html = renderToStaticMarkup(
		createElement(ExamplePicker, {selected: 'segmented', onSelect: () => {}}),
	);
	assert.equal((html.match(/type="radio"/g) ?? []).length, examplePresets.length);
	assert.equal((html.match(/checked=""/g) ?? []).length, 1);
	for (const group of exampleGroups) assert.ok(html.includes(group));
	assert.equal(new Set(examplePresets.map((preset) => preset.id)).size, examplePresets.length);
});

test('only the selected example code is rendered', () => {
	for (const preset of examplePresets) {
		const html = renderToStaticMarkup(
			createElement(ExamplePicker, {selected: preset.id, onSelect: () => {}}),
		);
		assert.equal((html.match(/<pre\b/g) ?? []).length, 1);
		assert.ok(html.includes(`aria-label="${preset.label} code"`));
		for (const link of preset.links) assert.ok(html.includes(`href="${link.href}"`));
	}
});

test('combined example shares audio, aligns the mask, and disables duplicate playback', () => {
	const combined = examplePresets.find((preset) => preset.id === 'combined')!;
	assert.equal((combined.code.match(/audioSrc=\{audioSrc\}/g) ?? []).length, 2);
	assert.equal((combined.code.match(/radius=\{0\.18\}/g) ?? []).length, 2);
	assert.ok(combined.code.includes('playAudio={false}'));
	assert.ok(combined.code.includes('maskHalo'));
});
