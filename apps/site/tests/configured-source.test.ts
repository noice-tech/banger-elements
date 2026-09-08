import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {configuredPayload, type SourcePayload} from '../src/components/configured-source';
import {examples, defaultAudioFor} from '../src/components/preview/examples';
import {sourceSettings} from '../../../packages/elements/scripts/source-settings';
import {catalog} from '../../../packages/elements/src/catalog';

test('each element generates source defaults from its preview without a wrapper', () => {
	for (const {slug} of catalog) {
		const example = examples[slug as keyof typeof examples];
		const template: SourcePayload = JSON.parse(
			readFileSync(
				new URL(`../../../packages/elements/dist/payloads/${slug}.json`, import.meta.url),
				'utf8',
			),
		);
		const props = {
			...example.props,
			width: example.width,
			height: example.height,
			audioSrc: defaultAudioFor(slug as keyof typeof examples),
			playAudio: false,
		};
		for (const key of Object.keys(props))
			assert.ok(template.sourceSettings[key], `${slug}: ${key}`);
		const result = configuredPayload(template, props);
		const defaults = sourceSettings(result.element.sourceCode);
		for (const [key, value] of Object.entries(props))
			assert.equal(defaults[key].value, value, `${slug}: ${key}`);
		assert.deepEqual(result.element.dimensions, {width: example.width, height: example.height});
		assert.equal(
			configuredPayload({...template, element: result.element, sourceSettings: defaults}, props)
				.element.sourceCode,
			result.element.sourceCode,
		);
		assert.throws(() => configuredPayload(template, {...props, audioSrc: 'blob:local'}), /hosted/);
	}
});
