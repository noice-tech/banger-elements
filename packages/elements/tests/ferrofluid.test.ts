import assert from 'node:assert/strict';
import test from 'node:test';
import type {MediaUtilsAudioData} from '@remotion/media-utils';
import {loadHelpers, mockCanvas} from './helpers';

function load() {
	return loadHelpers('ferrofluid', [
		'createSphere',
		'createFerrofluidAudio',
		'setupFerrofluid',
		'drawFerrofluid',
		'cleanupFerrofluid',
		'ferrofluidSchema',
	]) as {
		createSphere: (segments: number) => {positions: Float32Array; indices: Uint32Array};
		createFerrofluidAudio: (
			input: {
				audioData: MediaUtilsAudioData;
				dataOffsetInSeconds: number;
				sourceTime: number;
				fps: number;
			},
			gain: number,
		) => {bars: number[]; texture: Uint8Array; momentum: number};
		setupFerrofluid: (canvas: HTMLCanvasElement, quality: string, mapping: string) => unknown;
		drawFerrofluid: (state: unknown, frame: Record<string, unknown>) => void;
		cleanupFerrofluid: (state: unknown) => void;
		ferrofluidSchema: Record<string, {default: unknown}>;
	};
}
const helpers = load();

for (const segments of [64, 128, 256]) {
	test(`Ferrofluid: ${segments}-segment sphere is indexed, closed and outward-facing`, () => {
		const {positions, indices} = helpers.createSphere(segments);
		assert.equal(positions.length, (segments + 1) ** 2 * 3);
		assert.equal(indices.length, 6 * segments * (segments - 1));
		for (let i = 0; i < positions.length; i += 3) {
			assert.ok(Math.abs(Math.hypot(...positions.subarray(i, i + 3)) - 2) < 1e-6);
		}
		for (let y = 0; y <= segments; y++) {
			const first = y * (segments + 1) * 3;
			const last = first + segments * 3;
			for (let axis = 0; axis < 3; axis++)
				assert.ok(Math.abs(positions[first + axis] - positions[last + axis]) < 1e-6);
		}
		for (let i = 0; i < indices.length; i += 3) {
			const a = indices[i] * 3,
				b = indices[i + 1] * 3,
				c = indices[i + 2] * 3;
			assert.ok(Math.max(a, b, c) < positions.length);
			const u = [0, 1, 2].map((j) => positions[b + j] - positions[a + j]);
			const v = [0, 1, 2].map((j) => positions[c + j] - positions[a + j]);
			const cross = [
				u[1] * v[2] - u[2] * v[1],
				u[2] * v[0] - u[0] * v[2],
				u[0] * v[1] - u[1] * v[0],
			];
			assert.ok(cross.reduce((sum, value, j) => sum + value * positions[a + j], 0) > 0);
		}
	});
}

test('Ferrofluid: requires WebGL2 explicitly', () => {
	assert.throws(
		() =>
			helpers.setupFerrofluid(
				{getContext: () => null} as unknown as HTMLCanvasElement,
				'medium',
				'uniform',
			),
		/requires WebGL2/,
	);
});
for (const failure of [
	'vertex',
	'fragment',
	'link',
	'vao',
	'first-buffer',
	'second-buffer',
	'texture',
] as const) {
	test(`Ferrofluid: releases partial allocations on ${failure} failure`, () => {
		const {canvas, calls} = mockCanvas(failure);
		assert.throws(() => helpers.setupFerrofluid(canvas, 'low', 'uniform'), /Ferrofluid/);
		assert.equal(calls.filter(({name}) => name === 'deleteProgram').length, 1);
		assert.equal(
			calls.filter(({name}) => name === 'deleteShader').length,
			failure === 'vertex' ? 1 : 2,
		);
		const deletedBuffers = calls.filter(({name}) => name === 'deleteBuffer');
		assert.equal(
			deletedBuffers.length,
			failure === 'texture' ? 2 : failure === 'second-buffer' ? 1 : 0,
		);
	});
}

const frame = {
	...Object.fromEntries(
		Object.entries(helpers.ferrofluidSchema).map(([key, value]) => [key, value.default]),
	),
	time: 2,
	audio: {bars: Array(308).fill(0.5), texture: new Uint8Array(308 * 4), momentum: 0.4},
};
test('Ferrofluid: depth-tested indexed drawing, alpha clear and full cleanup', () => {
	const {canvas, calls, constants} = mockCanvas();
	const state = helpers.setupFerrofluid(canvas, 'medium', 'uniform');
	helpers.drawFerrofluid(state, frame);
	assert.ok(
		calls.some(({name, args}) => name === 'enable' && args[0] === constants.get('DEPTH_TEST')),
	);
	assert.ok(calls.some(({name, args}) => name === 'clearColor' && args.every((v) => v === 0)));
	assert.ok(
		calls.some(
			({name, args}) =>
				name === 'drawElements' &&
				args[1] === 6 * 128 * 127 &&
				args[2] === constants.get('UNSIGNED_INT'),
		),
	);
	assert.ok(
		calls.findIndex(({name}) => name === 'finish') >
			calls.findIndex(({name}) => name === 'drawElements'),
	);
	helpers.cleanupFerrofluid(state);
	for (const [resource, count] of [
		['Buffer', 2],
		['Texture', 1],
		['VertexArray', 1],
		['Program', 1],
	] as const) {
		assert.equal(calls.filter(({name}) => name === `delete${resource}`).length, count);
	}
});
test('Ferrofluid: shine defaults to warm ginger and updates independently in linear RGB', () => {
	assert.equal(helpers.ferrofluidSchema.shineColor.default, '#ffbc8e');
	const {canvas, calls} = mockCanvas();
	const state = helpers.setupFerrofluid(canvas, 'medium', 'uniform');
	try {
		for (const [shineColor, expected] of [
			['#ffffff', [1, 1, 1]],
			['#ff8000', [1, ((128 / 255 + 0.055) / 1.055) ** 2.4, 0]],
			['#000000', [0, 0, 0]],
		] as const) {
			calls.length = 0;
			helpers.drawFerrofluid(state, {...frame, color: '#ffffff', shineColor});
			const uploaded = (name: string) =>
				Array.from(
					calls.find((call) => call.name === 'uniform3fv' && call.args[0] === name)!
						.args[1] as number[],
				);
			assert.deepEqual(uploaded('uShineColor'), [...expected]);
			assert.deepEqual(uploaded('uColor'), [1, 1, 1]);
		}
	} finally {
		helpers.cleanupFerrofluid(state);
	}
});

test('Ferrofluid: shine direction, intensity and size update safely', () => {
	const {canvas, calls} = mockCanvas();
	const state = helpers.setupFerrofluid(canvas, 'medium', 'uniform');
	try {
		for (const [position, expected] of [
			[
				[-0.3, -1, -0.5],
				[-0.3, -1, -0.5],
			],
			[
				[1, 2, 3],
				[1, 2, 3],
			],
			[
				[0, 0, 0],
				[-0.3, -1, -0.5],
			],
			[
				[1, 0, 0],
				[1, 0, 0],
			],
			[
				[20, -20, 0],
				[3, -3, 0],
			],
		] as const) {
			calls.length = 0;
			helpers.drawFerrofluid(state, {
				...frame,
				shineX: position[0],
				shineY: position[1],
				shineZ: position[2],
				shineIntensity: 0,
				shineSize: 0,
			});
			const direction = calls.find(
				({name, args}) => name === 'uniform3fv' && args[0] === 'uShinePosition',
			)!.args[1] as number[];
			assert.deepEqual(Array.from(direction), [...expected]);
			assert.ok(
				calls.some(
					({name, args}) => name === 'uniform1f' && args[0] === 'uShineIntensity' && args[1] === 0,
				),
			);
			assert.ok(
				calls.some(
					({name, args}) => name === 'uniform1f' && args[0] === 'uShineSize' && args[1] === 0.1,
				),
			);
		}
	} finally {
		helpers.cleanupFerrofluid(state);
	}
});

test('Ferrofluid: disabling rotation sends zero angles and draw errors propagate', () => {
	const {canvas, calls} = mockCanvas('draw');
	const state = helpers.setupFerrofluid(canvas, 'low', 'latitude');
	try {
		assert.throws(
			() => helpers.drawFerrofluid(state, {...frame, autoRotate: false}),
			/WebGL draw failed/,
		);
		assert.ok(
			calls.some(
				({name, args}) =>
					name === 'uniform2f' && args[0] === 'uRotation' && args[1] === 0 && args[2] === 0,
			),
		);
	} finally {
		helpers.cleanupFerrofluid(state);
	}
});

test('Ferrofluid: audio texture and momentum are independent of render order and window origin', () => {
	const samples = Float32Array.from(
		{length: 6 * 44100},
		(_, i) => Math.sin((i * Math.PI * 2 * 110) / 44100) * (0.3 + 0.2 * Math.sin(i / 2000)),
	);
	const audioData: MediaUtilsAudioData = {
		channelWaveforms: [samples],
		sampleRate: 44100,
		durationInSeconds: 26,
		numberOfChannels: 1,
		resultId: 'ferrofluid-history',
		isRemote: false,
	};
	const input = {audioData, dataOffsetInSeconds: 20, sourceTime: 24.5, fps: 60};
	const cold = load().createFerrofluidAudio(input, 10);
	for (const sourceTime of [25.5, 24, 25])
		helpers.createFerrofluidAudio({...input, sourceTime}, 10);
	const warm = helpers.createFerrofluidAudio(input, 10);
	assert.equal(cold.momentum, warm.momentum);
	assert.deepEqual(Buffer.from(cold.texture), Buffer.from(warm.texture));
	assert.ok(
		cold.texture.some((v, i) => i % 4 === 0 && v > 0),
		'Synthetic tone produces reactive audio',
	);
	const at30 = {...input, fps: 30};
	const cold30 = load().createFerrofluidAudio(at30, 10);
	const warm30 = helpers.createFerrofluidAudio(at30, 10);
	assert.equal(cold30.momentum, warm30.momentum);
	assert.deepEqual(Buffer.from(cold30.texture), Buffer.from(warm30.texture));
	const silent = helpers.createFerrofluidAudio({...input, sourceTime: 32}, 10);
	assert.equal(silent.momentum, 0);
	assert.deepEqual([...silent.texture], [0, 0, 0, 255]);
	const beginning = helpers.createFerrofluidAudio(
		{...input, dataOffsetInSeconds: 0, sourceTime: -1},
		10,
	);
	assert.deepEqual([...beginning.texture], [0, 0, 0, 255]);
});
