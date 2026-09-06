import assert from 'node:assert/strict';
import test from 'node:test';
import {configuredJsx, isAdvancedControl} from '../src/components/preview-config';

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
