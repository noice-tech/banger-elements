import assert from 'node:assert/strict';
import test from 'node:test';
import {visualizeAudio} from '@remotion/media-utils';
import {cacheVisualizer} from '../src/components/preview/visualizer-cache';

const sampleRate = 44100;

function track(seed: number) {
	const samples = new Float32Array(sampleRate * 4);
	for (let index = 0; index < samples.length; index++) {
		samples[index] =
			0.6 * Math.sin(index * 0.031 * seed) + 0.3 * Math.sin(index * 0.0043 * seed ** 2);
	}
	return {
		channelWaveforms: [samples],
		sampleRate,
		durationInSeconds: 4,
		numberOfChannels: 1,
		resultId: `seed-${seed}`,
		isRemote: false,
	};
}

const params = (audioData: ReturnType<typeof track>, frame: number, fps = 60) => ({
	audioData,
	frame,
	fps,
	numberOfSamples: 4096,
	optimizeFor: 'speed' as const,
	smoothing: true,
	dataOffsetInSeconds: 0,
});

test('the cached spectrum is exactly what visualizeAudio returns', () => {
	const cached = cacheVisualizer(visualizeAudio);
	const audio = track(1);
	for (const frame of [30, 31, 32, 90, 91, 150]) {
		assert.deepEqual(cached(params(audio, frame)), visualizeAudio(params(audio, frame)));
	}
});

test('consecutive frames and layers with their own copy of the audio share spectra', () => {
	const cached = cacheVisualizer(visualizeAudio);
	const first = track(2);
	// Each element decodes its own buffer: same content, different identity and result id.
	const copy = {
		...first,
		resultId: 'other-layer',
		channelWaveforms: [first.channelWaveforms[0]!.slice()],
	};

	cached(params(first, 60));
	assert.deepEqual(cached.stats, {hits: 0, misses: 3});
	// Next frame at the same rate reuses two of the three windows.
	cached(params(first, 61));
	assert.deepEqual(cached.stats, {hits: 2, misses: 4});
	// Another layer reading the same moment reuses all of them.
	assert.deepEqual(cached(params(copy, 61)), visualizeAudio(params(first, 61)));
	assert.deepEqual(cached.stats, {hits: 5, misses: 4});
});

test('different audio, offsets and settings never share a spectrum', () => {
	const cached = cacheVisualizer(visualizeAudio);
	const one = track(3);
	const other = track(4);
	assert.notDeepEqual(cached(params(one, 60)), cached(params(other, 60)));
	assert.deepEqual(cached(params(other, 60)), visualizeAudio(params(other, 60)));

	const shifted = {...params(one, 60), dataOffsetInSeconds: 0.5};
	assert.deepEqual(cached(shifted), visualizeAudio(shifted));
	const accurate = {...params(one, 60), numberOfSamples: 1024, optimizeFor: 'accuracy' as const};
	assert.deepEqual(cached(accurate), visualizeAudio(accurate));
});

test('the cache stays bounded and unsmoothed calls pass through', () => {
	const cached = cacheVisualizer(visualizeAudio, 6);
	const audio = track(5);
	for (let frame = 10; frame < 40; frame += 3) cached(params(audio, frame));
	// Evicted windows are computed again, still correctly.
	assert.deepEqual(cached(params(audio, 10)), visualizeAudio(params(audio, 10)));
	const raw = {...params(audio, 20), smoothing: false};
	const before = {...cached.stats};
	assert.deepEqual(cached(raw), visualizeAudio(raw));
	assert.deepEqual(cached.stats, before);
});
