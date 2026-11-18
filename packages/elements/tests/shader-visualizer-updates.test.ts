import assert from 'node:assert/strict';
import test from 'node:test';
import {loadHelpers, mockCanvas} from './helpers';

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
				if (key === 'texElementSubImage2D') return undefined;
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

	test(`${name}: copies captures into sized storage on Chromium 158+`, () => {
		const helpers = loadHelpers(slug, [`create${name}WebGl`, `draw${name}WebGl`, schema]) as Record<
			string,
			unknown
		>;
		const setup = helpers[`create${name}WebGl`] as (
			canvas: HTMLCanvasElement,
		) => Record<string, unknown>;
		const draw = helpers[`draw${name}WebGl`] as (...args: unknown[]) => void;
		const {canvas, calls} = mockCanvas();
		const state = setup(canvas);
		const gl = canvas.getContext('webgl2')!;
		const fields = helpers[schema] as Record<string, {default: unknown}>;
		const props = Object.fromEntries(
			Object.entries(fields)
				.filter(([, field]) => field && typeof field === 'object' && 'default' in field)
				.map(([key, field]) => [key, field.default]),
		);
		const image = {};
		const frame = (width: number, density: number) =>
			draw(
				state,
				image,
				{...props, width, height: 360, time: 2},
				...(name === 'Vhs' ? [2, density] : [density]),
			);
		frame(640, 2);
		frame(640, 2);
		frame(320, 2);
		const named = (method: string) => calls.filter((call) => call.name === method);
		// Storage is (re)allocated only when the pixel size changes, at that size.
		const allocations = named('texImage2D').map((call) => call.args.slice(3, 5));
		assert.deepEqual(allocations, [
			[1280, 720],
			[640, 720],
		]);
		const copies = named('texElementSubImage2D');
		assert.equal(copies.length, 3);
		// The copy config comes from the element's own realm, so compare its fields.
		const size = (args: unknown[]) => ({...(args[5] as {width: number; height: number})});
		assert.deepEqual(copies[0]!.args.slice(0, 5), [gl.TEXTURE_2D, 0, 0, 0, image]);
		assert.deepEqual(size(copies[0]!.args), {width: 1280, height: 720});
		assert.deepEqual(size(copies[2]!.args), {width: 640, height: 720});
		assert.equal(named('texElementImage2D').length, 0);
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
