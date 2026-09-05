import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as MediaUtils from '@remotion/media-utils';
import type {MediaUtilsAudioData} from '@remotion/media-utils';
import * as Media from '@remotion/media';

// Expose private helpers only in this test's in-memory module. Delivered files
// retain exactly one exported component and no test/runtime dependency.
function loadHelpers(element: string, names: string[]) {
	const source = readFileSync(`src/elements/${element}/${element}.tsx`, 'utf8');
	const {outputText} = ts.transpileModule(`${source}\nexport {${names.join(',')}};`, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			jsx: ts.JsxEmit.ReactJSX,
			target: ts.ScriptTarget.ES2022,
			esModuleInterop: true,
		},
	});
	const exports = {};
	const require = createRequire(import.meta.url);
	runInNewContext(outputText, {
		exports,
		require: (name: string) => {
			if (name === '@remotion/media') return Media;
			if (name === '@remotion/media-utils') return MediaUtils;
			return require(name);
		},
	});
	return exports;
}

for (const element of [
	'waveform',
	'spectre',
	'oscilloscope',
	'pulsar',
	'circle',
	'halo',
	'audio-particles',
]) {
	const {hasCompleteAudioWindow} = loadHelpers(element, ['hasCompleteAudioWindow']) as {
		hasCompleteAudioWindow: (data: MediaUtilsAudioData, origin: number, time: number) => boolean;
	};
	test(`${element}: waits for all retained windows and respects buffer origin`, () => {
		const data: MediaUtilsAudioData = {
			channelWaveforms: [new Float32Array(60 * 100)],
			sampleRate: 100,
			durationInSeconds: 100,
			numberOfChannels: 1,
			resultId: 'test',
			isRemote: false,
		};
		assert.equal(hasCompleteAudioWindow(data, 20, 40), true);
		assert.equal(hasCompleteAudioWindow(data, 0, 40), false);
		assert.equal(
			hasCompleteAudioWindow(
				{
					...data,
					channelWaveforms: [new Float32Array(20 * 100)],
				},
				20,
				40,
			),
			false,
		);
		assert.equal(
			hasCompleteAudioWindow(
				{
					...data,
					durationInSeconds: 42,
					channelWaveforms: [new Float32Array(22 * 100)],
				},
				20,
				40,
			),
			true,
		);
	});
}

const {setupSpectre, cleanupSpectre, drawSpectre} = loadHelpers('spectre', [
	'setupSpectre',
	'cleanupSpectre',
	'drawSpectre',
]) as {
	setupSpectre: (canvas: HTMLCanvasElement, fragment: string) => unknown;
	cleanupSpectre: (state: unknown) => void;
	drawSpectre: (state: unknown, frame: Record<string, unknown>) => void;
};

function mockCanvas(failure?: 'fragment' | 'link' | 'texture' | 'second-texture' | 'draw') {
	const calls: {name: string; args: unknown[]}[] = [];
	let shaderCount = 0;
	let textureCount = 0;
	const constants = new Map<string, number>();
	const gl = new Proxy(
		{},
		{
			get: (_, name: string) => {
				if (/^[A-Z_0-9]+$/.test(name)) {
					if (!constants.has(name)) constants.set(name, constants.size);
					return constants.get(name);
				}
				return (...args: unknown[]) => {
					calls.push({name, args});
					if (name === 'createShader') return {shader: ++shaderCount};
					if (name === 'getShaderParameter') return !(failure === 'fragment' && shaderCount === 2);
					if (name === 'getProgramParameter') return failure !== 'link';
					if (name === 'createTexture') {
						textureCount++;
						if (failure === 'texture' || (failure === 'second-texture' && textureCount === 2))
							return null;
						return {texture: textureCount};
					}
					if (name.startsWith('create')) return {name};
					if (name === 'getUniformLocation') return args[1];
					if (name === 'getAttribLocation') return 0;
					if (name === 'getError')
						return failure === 'draw' ? -1 : (constants.get('NO_ERROR') ?? constants.size);
					return null;
				};
			},
		},
	);
	const canvas = {getContext: () => gl} as unknown as HTMLCanvasElement;
	return {canvas, calls, constants};
}

test('Spectre reports unsupported WebGL rather than substituting a renderer', () => {
	assert.throws(
		() => setupSpectre({getContext: () => null} as unknown as HTMLCanvasElement, ''),
		/requires WebGL2/,
	);
});

for (const failure of ['fragment', 'link', 'texture'] as const) {
	test(`Spectre cleans up partial setup after ${failure} failure`, () => {
		const {canvas, calls} = mockCanvas(failure);
		assert.throws(() => setupSpectre(canvas, 'void main() {}'), /Spectre/);
		assert.equal(calls.filter(({name}) => name === 'deleteShader').length, 2);
		assert.equal(calls.filter(({name}) => name === 'deleteProgram').length, 1);
		if (failure === 'texture') {
			assert.ok(calls.some(({name, args}) => name === 'deleteBuffer' && args[0] !== null));
		}
	});
}

test('Spectre draws explicit typed uniforms and disposes owned resources', () => {
	const {canvas, calls} = mockCanvas();
	const state = setupSpectre(canvas, 'void main() {}');
	drawSpectre(state, {
		width: 900,
		height: 300,
		sourceTime: 40.1,
		barWidth: 3,
		count: 64.4,
		startColor: '#aa8bff',
		endColor: '#51e8cc',
		intensity: 2.5,
		bottom: true,
		colorMode: 'rainbow',
		texture: {width: 1, height: 1, data: new Uint8Array(4)},
	});
	assert.ok(
		calls.some(({name, args}) => name === 'uniform1f' && args[0] === 'iCount' && args[1] === 64),
	);
	assert.ok(
		calls.some(({name, args}) => name === 'uniform1i' && args[0] === 'iBottom' && args[1] === 1),
	);
	assert.ok(
		calls.some(({name, args}) => name === 'uniform1i' && args[0] === 'iColorMode' && args[1] === 2),
	);
	assert.ok(
		calls.findIndex(({name}) => name === 'finish') >
			calls.findIndex(({name}) => name === 'drawArrays'),
	);
	cleanupSpectre(state);
	for (const resource of ['Texture', 'Buffer', 'Program']) {
		assert.equal(calls.filter(({name}) => name === `delete${resource}`).length, 1);
	}
});

for (const [element, component, textureCount] of [
	['pulsar', 'Pulsar', 1],
	['circle', 'Circle', 1],
	['halo', 'Halo', 2],
	['audio-particles', 'AudioParticles', 2],
] as const) {
	const helpers = loadHelpers(element, [
		`setup${component}`,
		`draw${component}`,
		`cleanup${component}`,
	]) as Record<string, unknown>;
	const setup = helpers[`setup${component}`] as (
		canvas: HTMLCanvasElement,
		fragment: string,
	) => unknown;
	const draw = helpers[`draw${component}`] as (
		state: unknown,
		frame: Record<string, unknown>,
	) => void;
	const cleanup = helpers[`cleanup${component}`] as (state: unknown) => void;
	const texture = {width: 1, height: 1, data: new Uint8Array(4)};
	const frame = {
		width: 450,
		height: 400,
		sourceTime: 40.1,
		texture,
		history: texture,
		bassHistory: texture,
		startColor: '#aa8bff',
		endColor: '#51e8cc',
		color: '#aa8bff',
		colorMode: 'rainbow',
		circleVariant: 'glow-ring',
		count: 64,
		lineWidth: 3,
		density: 3,
		pattern: 4,
		volume: 3,
		intensity: 2.5,
		radius: 0.18,
		trailDepth: 7,
		waveDelay: true,
		glowBlur: 35,
		glowSpread: 20,
		bass: 0.5,
		endTime: 40.1,
		size: 1,
		reactiveSpeed: true,
		maskHalo: true,
		image: null,
	};

	test(`${component}: unsupported WebGL is an explicit error`, () => {
		assert.throws(
			() => setup({getContext: () => null} as unknown as HTMLCanvasElement, ''),
			/requires WebGL2/,
		);
	});

	for (const failure of [
		'fragment',
		'link',
		'texture',
		...(textureCount === 2 ? (['second-texture'] as const) : []),
	] as const) {
		test(`${component}: cleans up after ${failure} failure`, () => {
			const {canvas, calls} = mockCanvas(failure);
			assert.throws(() => setup(canvas, 'void main() {}'));
			assert.equal(calls.filter(({name}) => name === 'deleteShader').length, 2);
			assert.equal(calls.filter(({name}) => name === 'deleteProgram').length, 1);
			if (failure === 'texture' || failure === 'second-texture') {
				assert.ok(calls.some(({name, args}) => name === 'deleteBuffer' && args[0] !== null));
			}
			if (failure === 'second-texture') {
				assert.equal(
					calls.filter(({name, args}) => name === 'deleteTexture' && args[0] !== null).length,
					1,
				);
			}
		});
	}

	test(`${component}: draws with explicit uniforms and releases every resource`, () => {
		const {canvas, calls, constants} = mockCanvas();
		const state = setup(canvas, 'void main() {}');
		draw(state, frame);
		const uniform = (method: string, name: string, value: number) =>
			assert.ok(
				calls.some(
					(call) => call.name === method && call.args[0] === name && call.args[1] === value,
				),
				`${method}(${name}, ${value})`,
			);
		if (component === 'Circle') {
			uniform('uniform1i', 'iSmooth', 1);
			uniform('uniform1i', 'iColorMode', 2);
			uniform('uniform2f', 'iResolution', 450);
		} else {
			uniform('uniform1f', 'iAspect', 450 / 400);
		}
		if (component === 'Halo') {
			uniform('uniform1f', 'iWaveDelay', 1);
			draw(state, {...frame, image: {naturalWidth: 80, naturalHeight: 40}});
			uniform('uniform1f', 'iHasCenterImage', 1);
			uniform('uniform1f', 'iCenterImageAspectRatio', 2);
			assert.ok(calls.some(({name, args}) => name === 'pixelStorei' && args[1] === true));
		}
		if (component === 'AudioParticles') {
			uniform('uniform1f', 'iParticleReactiveSpeed', 1);
			uniform('uniform1i', 'iMaskHalo', 1);
		}
		assert.ok(
			calls.some(
				({name, args}) =>
					name === 'drawArrays' &&
					args[0] === constants.get(component === 'AudioParticles' ? 'POINTS' : 'TRIANGLES'),
			),
		);
		assert.ok(
			calls.findIndex(({name}) => name === 'finish') >
				calls.findIndex(({name}) => name === 'drawArrays'),
		);
		cleanup(state);
		for (const resource of ['Texture', 'Buffer', 'Program']) {
			assert.equal(
				calls.filter(({name}) => name === `delete${resource}`).length,
				resource === 'Texture' ? textureCount : 1,
			);
		}
	});

	test(`${component}: reports GPU draw failures`, () => {
		const {canvas} = mockCanvas('draw');
		const state = setup(canvas, 'void main() {}');
		try {
			assert.throws(() => draw(state, frame), /WebGL draw failed/);
		} finally {
			cleanup(state);
		}
	});
}

for (const [element, helper] of [
	['halo', 'createHaloHistory'],
	['audio-particles', 'createParticleHistory'],
] as const) {
	test(`${element}: source history is independent of cache/render order`, () => {
		type History = {
			bass: number;
			history: {data: Uint8Array};
			bassHistory?: {data: Uint8Array};
		};
		type HistoryInput = {
			audioData: MediaUtilsAudioData;
			dataOffsetInSeconds: number;
			sourceTime: number;
			inputGainDb: number;
			trailDepth: number;
			waveDelay: boolean;
			maskHalo: boolean;
			reactiveSpeed: boolean;
		};
		const load = () =>
			(loadHelpers(element, [helper]) as Record<string, (input: HistoryInput) => History>)[helper];
		const samples = Float32Array.from(
			{length: 22 * 8000},
			(_, i) => Math.sin((i * Math.PI * 2 * 110) / 8000) * 0.4,
		);
		const input: HistoryInput = {
			audioData: {
				channelWaveforms: [samples],
				sampleRate: 8000,
				durationInSeconds: 42,
				numberOfChannels: 1,
				resultId: 'history-test',
				isRemote: false,
			},
			dataOffsetInSeconds: 20,
			sourceTime: 40,
			inputGainDb: 0,
			trailDepth: 7,
			waveDelay: true,
			maskHalo: true,
			reactiveSpeed: true,
		};
		const expected = load()(input);
		const warm = load();
		for (const sourceTime of [41, 39, 40.1]) warm({...input, sourceTime});
		const actual = warm(input);
		assert.equal(actual.bass, expected.bass);
		assert.deepEqual(Buffer.from(actual.history.data), Buffer.from(expected.history.data));
		if (actual.bassHistory && expected.bassHistory) {
			assert.deepEqual(
				Buffer.from(actual.bassHistory.data),
				Buffer.from(expected.bassHistory.data),
			);
		}
		const silent = warm({...input, sourceTime: 48});
		assert.equal(silent.bass, 0);
		assert.ok(silent.history.data.every((byte) => byte === 0));
	});
}
