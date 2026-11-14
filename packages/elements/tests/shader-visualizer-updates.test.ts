import assert from 'node:assert/strict';
import test from 'node:test';
import {loadHelpers, mockCanvas} from './helpers';

const shaders = ['pulse', 'rooftop', 'cathedral', 'liquid', 'chrome', 'neuron', 'matrix'];

for (const [slug, name, schema] of [
	['vhs', 'Vhs', 'vhsSchema'],
	['fisheye', 'Fisheye', 'fisheyeSchema'],
	['wet-glass', 'WetGlass', 'wetGlassSchema'],
]) {
	test(`${name}: supports Chromium 156's three-argument capture upload`, () => {
		const helpers = loadHelpers(slug, [`create${name}WebGl`, `draw${name}WebGl`, schema]) as Record<
			string,
			unknown
		>;
		const setup = helpers[`create${name}WebGl`] as (
			canvas: HTMLCanvasElement,
		) => Record<string, unknown>;
		const draw = helpers[`draw${name}WebGl`] as (...args: unknown[]) => void;
		const {canvas} = mockCanvas();
		const state = setup(canvas);
		const uploads: unknown[][] = [];
		const upload = (target: number, format: number, image: unknown) => {
			uploads.push([target, format, image]);
		};
		const gl = new Proxy(canvas.getContext('webgl2')!, {
			get(target, key) {
				return key === 'texElementImage2D' ? upload : Reflect.get(target, key);
			},
		});
		const fields = helpers[schema] as Record<string, {default: unknown}>;
		const props = Object.fromEntries(
			Object.entries(fields)
				.filter(([, field]) => field && typeof field === 'object' && 'default' in field)
				.map(([key, field]) => [key, field.default]),
		);
		const image = {};
		draw({...state, gl}, image, {...props, time: 2}, ...(name === 'Vhs' ? [2, 1] : [1]));
		assert.equal(uploads.length, 1);
		assert.deepEqual(uploads[0], [gl.TEXTURE_2D, gl.RGBA8, image]);
	});
}

for (const slug of shaders) {
	const name = slug[0].toUpperCase() + slug.slice(1);
	const helpers = loadHelpers(slug, [
		`setup${name}`,
		`draw${name}`,
		`cleanup${name}`,
		`${slug}Schema`,
		'spectrumBars',
	]) as Record<string, unknown>;
	const setup = helpers[`setup${name}`] as (canvas: HTMLCanvasElement) => unknown;
	const draw = helpers[`draw${name}`] as (state: unknown, frame: Record<string, unknown>) => void;
	const cleanup = helpers[`cleanup${name}`] as (state: unknown) => void;
	const defaults = Object.fromEntries(
		Object.entries(helpers[`${slug}Schema`] as Record<string, {default: unknown}>)
			.filter(([, field]) => field && typeof field === 'object' && 'default' in field)
			.map(([key, field]) => [key, (field as {default: unknown}).default]),
	);
	for (const failure of [
		'vertex',
		'fragment',
		'link',
		'first-buffer',
		'texture',
		...(slug === 'chrome' || slug === 'matrix' ? ['second-texture'] : []),
	] as const) {
		test(`${name}: releases partial allocations on ${failure} failure`, () => {
			const {canvas, calls} = mockCanvas(failure as Parameters<typeof mockCanvas>[0]);
			assert.throws(() => setup(canvas));
			assert.equal(calls.filter((c) => c.name === 'deleteProgram').length, 1);
			for (const resource of ['Shader', 'Buffer', 'Texture']) {
				const created = calls.filter((c) => c.name === `create${resource}`).length;
				const released = calls.filter((c) => c.name === `delete${resource}` && c.args[0]).length;
				const failed =
					(resource === 'Buffer' && failure === 'first-buffer') ||
					(resource === 'Texture' && String(failure).includes('texture'));
				assert.equal(released, created - Number(failed), resource);
			}
		});
	}
	test(`${name}: draws deterministic audio uniforms and cleans up`, () => {
		const {canvas, calls} = mockCanvas();
		const state = setup(canvas);
		const frame = {...defaults, time: 1.6, bars: Array.from({length: 308}, () => 0.1)};
		draw(state, frame);
		assert.ok(calls.some((c) => c.name === 'drawArrays'));
		assert.ok(
			calls.some((c) => c.name === 'uniform1i' && c.args[0] === 'iSoundTexture' && c.args[1] === 0),
		);
		assert.ok(
			calls.some((c) => c.name === 'uniform1f' && c.args[0] === 'iGlobalTime' && c.args[1] === 1.6),
		);
		assert.ok(
			calls.some((c) => c.name === 'uniform1f' && c.args[0] === 'iLowFreq' && c.args[1] === 0.1),
		);
		cleanup(state);
		assert.equal(calls.filter((c) => c.name === 'deleteProgram').length, 1);
		assert.equal(
			calls.filter((c) => c.name === 'deleteTexture' && c.args[0]).length,
			slug === 'chrome' || slug === 'matrix' ? 2 : 1,
		);
	});
}

const {computeAmplitudeSpectrum, computeBars: computeLogBars} = loadHelpers('pulse', [
	'computeAmplitudeSpectrum',
	'computeBars',
]) as {
	computeAmplitudeSpectrum: (input: {
		samples: Float32Array;
		center: number;
		size: number;
	}) => Float32Array;
	computeBars: (input: {
		amplitudes: Float32Array;
		sampleRate: number;
		fftSize: number;
		outputBarsCount: number;
	}) => number[];
};

for (const sampleRate of [22050, 44100, 48000]) {
	for (const frequency of [60, 1000, 8000]) {
		test(`spectrum: ${frequency} Hz retains its position at ${sampleRate} Hz`, () => {
			const samples = Float32Array.from(
				{length: sampleRate},
				(_, i) => 0.5 * Math.sin((2 * Math.PI * frequency * i) / sampleRate),
			);
			const amplitudes = computeAmplitudeSpectrum({samples, center: sampleRate / 2, size: 16384});
			for (const count of [33, 64, 160, 308]) {
				const bars = computeLogBars({
					amplitudes,
					sampleRate,
					fftSize: 16384,
					outputBarsCount: count,
				});
				assert.equal(bars.length, count);
				assert.ok(bars.every(Number.isFinite));
				const peak = bars.indexOf(Math.max(...bars));
				const expected = (Math.log(frequency / 20) / Math.log(1100)) * count;
				assert.ok(Math.abs(peak - expected) < 2, `${peak} vs ${expected}`);
			}
		});
	}
}

for (const slug of ['circle', 'spectre']) {
	const {computeBars} = loadHelpers(slug, ['computeBars']) as {
		computeBars: (input: {
			allVisualizationValues: number[];
			sampleRate: number;
			outputBarsCount: number;
		}) => number[];
	};
	test(`${slug}: preserves empty bands and maps FFT bins to actual Hertz`, () => {
		for (const sampleRate of [22050, 44100, 48000]) {
			const values = Array.from({length: 4096}, () => 0);
			values[Math.round((1000 / sampleRate) * 8192)] = 1;
			for (const count of [33, 64, 240]) {
				const bars = computeBars({
					allVisualizationValues: values,
					sampleRate,
					outputBarsCount: count,
				});
				assert.equal(bars.length, count);
				assert.ok(
					Math.abs(bars.indexOf(Math.max(...bars)) / count - Math.log(50) / Math.log(1100)) < 0.04,
				);
			}
			assert.ok(
				computeBars({
					allVisualizationValues: values.map(() => 0),
					sampleRate,
					outputBarsCount: 64,
				}).every((v) => v === 0),
			);
		}
	});
}

const {getOscilloscopeSamples} = loadHelpers('oscilloscope', ['getOscilloscopeSamples']) as {
	getOscilloscopeSamples: (input: {
		waveform: Float32Array;
		sampleRate: number;
		timeInSeconds: number;
		sampleCount: number;
		timeSpanMs?: number;
		displayMode: string;
		dataOffsetInSeconds?: number;
	}) => Float32Array;
};
const rate = 48000;
const waveform = Float32Array.from({length: rate * 3}, (_, i) =>
	Math.sin((2 * Math.PI * 110 * i) / rate),
);

test('oscilloscope: free-running span is independent of trace resolution', () => {
	const input = {
		waveform,
		sampleRate: rate,
		timeInSeconds: 1,
		timeSpanMs: 100,
		displayMode: 'free',
	};
	for (const sampleCount of [256, 1024, 4096]) {
		const samples = getOscilloscopeSamples({...input, sampleCount});
		assert.equal(samples.length, sampleCount);
		assert.ok(Math.abs(samples[0] - Math.sin(2 * Math.PI * 110 * 0.95)) < 0.001);
		assert.ok(Math.abs(samples.at(-1)! - Math.sin(2 * Math.PI * 110 * 1.05)) < 0.001);
	}
});

test('oscilloscope: pitch and single-cycle are seek-order and buffer-origin independent', () => {
	for (const displayMode of ['pitch', 'single-cycle']) {
		const input = {waveform, sampleRate: rate, timeInSeconds: 1.5, sampleCount: 1024, displayMode};
		const expected = Array.from(getOscilloscopeSamples(input));
		getOscilloscopeSamples({...input, timeInSeconds: 2});
		assert.deepEqual(Array.from(getOscilloscopeSamples(input)), expected);
		assert.deepEqual(
			Array.from(
				getOscilloscopeSamples({
					...input,
					waveform: waveform.subarray(rate),
					dataOffsetInSeconds: 1,
				}),
			),
			expected,
		);
		if (displayMode === 'single-cycle') {
			const crossings = expected.filter(
				(sample, i) => i > 0 && sample > 0 && expected[i - 1] <= 0,
			).length;
			assert.ok(crossings <= 1);
			assert.ok(Math.max(...expected) > 0.99 && Math.min(...expected) < -0.99);
			assert.ok(Math.abs(expected[0] - expected.at(-1)!) < 0.04);
		}
	}
});

const {createFrequencyColors} = loadHelpers('waveform', ['createFrequencyColors']) as {
	createFrequencyColors: (
		samples: Float32Array,
		sampleRate: number,
		offset: number,
	) => (time: number) => string;
};
test('waveform: frequency colors distinguish bass, mids and treble at multiple sample rates', () => {
	for (const sampleRate of [22050, 44100, 48000]) {
		for (const [frequency, band] of [
			[60, 0],
			[800, 1],
			[8000, 2],
		]) {
			const samples = Float32Array.from({length: sampleRate * 2}, (_, i) =>
				Math.sin((2 * Math.PI * frequency * i) / sampleRate),
			);
			const getColor = createFrequencyColors(samples, sampleRate, 0);
			const expected = getColor(1.5);
			const rgb = expected.match(/\d+/g)!.map(Number);
			assert.equal(rgb.indexOf(Math.max(...rgb)), band);
			getColor(0.2);
			assert.equal(getColor(1.5), expected);
			assert.equal(
				createFrequencyColors(samples.subarray(sampleRate), sampleRate, 1)(1.5),
				expected,
			);
		}
	}
});

const wet = loadHelpers('wet-glass', [
	'createWetGlassWebGl',
	'drawWetGlassWebGl',
	'cleanupWetGlassWebGl',
	'wetGlassSchema',
]) as {
	createWetGlassWebGl: (canvas: HTMLCanvasElement) => unknown;
	drawWetGlassWebGl: (
		state: unknown,
		image: unknown,
		props: Record<string, unknown>,
		pixelDensity: number,
	) => void;
	cleanupWetGlassWebGl: (state: unknown) => void;
	wetGlassSchema: Record<string, {default: unknown}>;
};
for (const failure of ['vertex', 'fragment', 'link', 'vao', 'first-buffer', 'texture'] as const) {
	test(`Wet Glass: releases partial resources on ${failure} failure`, () => {
		const {canvas, calls} = mockCanvas(failure);
		assert.throws(() => wet.createWetGlassWebGl(canvas));
		assert.equal(calls.filter((c) => c.name === 'deleteProgram').length, 1);
		for (const resource of ['Shader', 'VertexArray', 'Buffer', 'Texture']) {
			const failed =
				(resource === 'VertexArray' && failure === 'vao') ||
				(resource === 'Buffer' && failure === 'first-buffer') ||
				(resource === 'Texture' && failure === 'texture');
			assert.equal(
				calls.filter((c) => c.name === `delete${resource}` && c.args[0]).length,
				calls.filter((c) => c.name === `create${resource}`).length - Number(failed),
			);
		}
	});
}

test('Wet Glass: captures premultiplied children and sends deterministic phase/seed', () => {
	const {canvas, calls} = mockCanvas();
	const state = wet.createWetGlassWebGl(canvas);
	const props = Object.fromEntries(
		Object.entries(wet.wetGlassSchema)
			.filter(([, field]) => field && typeof field === 'object' && 'default' in field)
			.map(([key, field]) => [key, (field as {default: unknown}).default]),
	);
	wet.drawWetGlassWebGl(state, {}, {...props, time: 2, seed: 7}, 1);
	assert.ok(calls.some((c) => c.name === 'texElementImage2D'));
	assert.ok(calls.some((c) => c.name === 'pixelStorei' && c.args[1] === true));
	assert.ok(calls.some((c) => c.name === 'uniform1f' && c.args[0] === 'time' && c.args[1] === 2));
	assert.ok(calls.some((c) => c.name === 'uniform1f' && c.args[0] === 'seed' && c.args[1] === 7));
	wet.cleanupWetGlassWebGl(state);
	assert.equal(calls.filter((c) => c.name === 'deleteTexture').length, 1);
});
