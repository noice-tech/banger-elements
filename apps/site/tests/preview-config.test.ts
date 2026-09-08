import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ControlField} from '../src/components/preview/ControlField';
import {configuredJsx, isAdvancedControl} from '../src/components/preview-config';
import {examples} from '../src/components/preview/examples';

test('configuration export preserves typed preview values and standalone import', () => {
	const result = configuredJsx(
		'audio-particles',
		{
			color: '#ffffff',
			intensity: 2.5,
			playAudio: false,
			audioSrc: 'https://example.com/audio.mp3',
			width: 720,
		},
		false,
	);
	assert.ok(result.startsWith("import {AudioParticles} from './audio-particles.element';"));
	assert.ok(result.includes('intensity={2.5}'));
	assert.ok(result.includes('playAudio={false}'));
	assert.ok(result.includes('audioSrc={"https://example.com/audio.mp3"}'));
});

test('Trip: preview controls and exported settings preserve the original shader controls', () => {
	const {props, controls} = examples.trip;
	assert.equal(props.baseColor, '#ff00ff');
	assert.equal(props.intensifyColor, '#9333ea');
	assert.equal(props.intensity, 10);
	assert.equal(props.bpm, 120);
	assert.deepEqual(
		controls.map((control) => control.key),
		[
			'baseColor',
			'intensifyColor',
			'thickness',
			'pattern',
			'intensity',
			'bpm',
			'timeOffsetInSeconds',
			'inputGainDb',
		],
	);
	const result = configuredJsx(
		'trip',
		{...props, timeOffsetInSeconds: 3, audioOffsetInSeconds: 12},
		false,
	);
	assert.ok(result.startsWith("import {Trip} from './trip.element';"));
	for (const prop of [
		'intensity={10}',
		'bpm={120}',
		'timeOffsetInSeconds={3}',
		'audioOffsetInSeconds={12}',
	]) {
		assert.ok(result.includes(prop));
	}
});

test('Trip: native sliders represent defaults exactly and retain fractional display precision', () => {
	for (const key of ['thickness', 'pattern', 'intensity', 'bpm'] as const) {
		const control = examples.trip.controls.find((control) => control.key === key)!;
		const steps = (examples.trip.props[key] - control.min!) / control.step!;
		assert.ok(
			Math.abs(steps - Math.round(steps)) < 1e-8,
			`${key}: default is off the native range step grid`,
		);
	}
	const html = renderToStaticMarkup(
		createElement(ControlField, {
			control: {key: 'pattern', label: 'Pattern', type: 'range', min: 0.7, max: 9, step: 0.25},
			value: 0.95,
			update: () => {},
		}),
	);
	assert.ok(html.includes('<output>0.95</output>'));
});

test('Halo exports leadingColor and transparent center mode', () => {
	const result = configuredJsx('halo', {leadingColor: '#eee6ff', centerMode: 'transparent'}, false);
	assert.ok(result.includes('leadingColor={"#eee6ff"}'));
	assert.ok(result.includes('centerMode={"transparent"}'));
});

test('local audio export never leaks a temporary browser URL', () => {
	for (const local of [true, false]) {
		const result = configuredJsx(
			'ferrofluid',
			{audioSrc: 'blob:http://localhost/private-id'},
			local,
		);
		assert.ok(!result.includes('blob:'));
		assert.ok(result.includes('/audio/your-track.mp3'));
	}
	assert.ok(configuredJsx('halo', {audioSrc: 'blob:local'}, true).includes('Replace'));
});

test('local artwork export uses a project placeholder without leaking blob URLs', () => {
	for (const audioSrc of ['https://example.com/track.mp3', 'blob:private-audio']) {
		const result = configuredJsx('halo', {audioSrc, artworkSrc: 'blob:private-artwork'}, false);
		assert.ok(!result.includes('blob:'));
		assert.ok(result.includes('artworkSrc={"/images/your-artwork.png"}'));
		assert.ok(result.includes('// Replace /images/your-artwork.png'));
		assert.ok(result.includes(audioSrc.startsWith('blob:') ? '/audio/your-track.mp3' : audioSrc));
	}
});

test('empty artwork stays empty in exported code', () => {
	const result = configuredJsx('halo', {artworkSrc: ''}, false);
	assert.ok(result.includes('artworkSrc={""}'));
	assert.ok(!result.includes('/images/your-artwork.png'));
});

test('configuration safely serializes strings and excludes invalid numeric values', () => {
	const result = configuredJsx(
		'halo',
		{artworkSrc: 'https://example.com/"cover".jpg', width: NaN},
		false,
	);
	assert.ok(result.includes('artworkSrc={"https://example.com/\\"cover\\".jpg"}'));
	assert.ok(!result.includes('width='));
});

test('appearance controls stay upfront while rendering and lighting move to More', () => {
	for (const key of ['quality', 'shineX', 'mappingMode', 'roughness', 'rotationSpeed']) {
		assert.equal(isAdvancedControl(key), true);
	}
	for (const key of ['color', 'intensity', 'fluidity', 'pattern', 'inputGainDb']) {
		assert.equal(isAdvancedControl(key), false);
	}
});
