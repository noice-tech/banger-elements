import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {configuredPayload, type SourcePayload} from '../src/components/configured-source';
import {examples, defaultAudioFor} from '../src/components/preview/examples';
import {sourceSettings} from '../../../packages/elements/scripts/source-settings';
import {catalog} from '../../../packages/elements/src/catalog';

test('each element generates source defaults directly from its preview settings', () => {
	for (const {slug, category} of catalog) {
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
			...(category === 'effects'
				? {}
				: {
						audioSrc: defaultAudioFor(slug as keyof typeof examples),
						playAudio: false,
					}),
		};
		const fills = category === 'shaders';
		const sourceProps = Object.fromEntries(
			Object.entries(props).filter(([key]) => !fills || (key !== 'width' && key !== 'height')),
		);
		for (const key of Object.keys(sourceProps))
			assert.ok(template.sourceSettings[key], `${slug}: ${key}`);
		const result = configuredPayload(template, props);
		const defaults = sourceSettings(result.element.sourceCode);
		for (const [key, value] of Object.entries(sourceProps))
			assert.equal(defaults[key].value, value, `${slug}: ${key}`);
		assert.deepEqual(
			result.element.dimensions,
			fills ? null : {width: example.width, height: example.height},
		);
		if (fills) {
			assert.equal(template.sourceSettings.width, undefined, `${slug}: width`);
			const sized = configuredPayload(template, {...props, width: 1080, height: 1920});
			assert.deepEqual(sized.element.dimensions, {width: 1080, height: 1920});
			assert.equal(sized.element.initialProps?.width, 1080);
			assert.equal(sized.element.initialProps?.height, 1920);
			assert.equal(sized.element.sourceCode, result.element.sourceCode);
		}
		assert.equal(
			configuredPayload({...template, element: result.element, sourceSettings: defaults}, props)
				.element.sourceCode,
			result.element.sourceCode,
		);
		if (category === 'effects') {
			assert.equal(
				configuredPayload(template, {...props, audioSrc: 'blob:local', playAudio: true}).element
					.sourceCode,
				result.element.sourceCode,
			);
		} else {
			assert.throws(
				() => configuredPayload(template, {...props, audioSrc: 'blob:local'}),
				/hosted/,
			);
		}
	}
});

test('the demo track is installed as a project asset until the user picks their own audio', () => {
	for (const {slug, category} of catalog) {
		if (category === 'effects') continue;
		const template: SourcePayload = JSON.parse(
			readFileSync(
				new URL(`../../../packages/elements/dist/payloads/${slug}.json`, import.meta.url),
				'utf8',
			),
		);
		const demo = template.sourceSettings.audioSrc!.value;
		const [asset] = template.element.assets;
		assert.equal(asset?.type === 'url' && asset.url, demo, slug);
		assert.deepEqual(template.element.initialProps?.audioSrc, {
			__remotion_element_asset: asset!.path,
		});

		const example = examples[slug as keyof typeof examples];
		const base = {...example.props, width: example.width, height: example.height};
		const withDemo = configuredPayload(template, {...base, audioSrc: demo as string});
		assert.deepEqual(withDemo.element.assets, template.element.assets, slug);
		assert.deepEqual(
			withDemo.element.initialProps?.audioSrc,
			template.element.initialProps?.audioSrc,
		);

		const own = configuredPayload(template, {...base, audioSrc: 'https://example.com/track.mp3'});
		assert.deepEqual(own.element.assets, [], slug);
		assert.equal(own.element.initialProps?.audioSrc, undefined, slug);
		assert.ok(own.element.sourceCode.includes('"https://example.com/track.mp3"'), slug);
	}
});
