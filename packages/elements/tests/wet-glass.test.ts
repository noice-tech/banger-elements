import assert from 'node:assert/strict';
import test from 'node:test';
import {loadHelpers, mockCanvas} from './helpers';

type DropMapRenderer = {
	draw: (params: {
		width: number;
		height: number;
		amount: number;
		speed: number;
		dropSize: number;
		seed: number;
		refraction: number;
		offsetRange: number;
		time: number;
	}) => string;
	dispose: () => void;
};

function loadWetGlass(canvas: unknown) {
	const document = {createElement: () => canvas};
	return loadHelpers(
		'wet-glass',
		['createDropMapRenderer', 'fragmentShader', 'dropMapShader'],
		{},
		{
			document,
		},
	) as {
		createDropMapRenderer: () => DropMapRenderer | null;
		fragmentShader: string;
		dropMapShader: string;
	};
}

const params = {
	width: 1280,
	height: 720,
	amount: 0.65,
	speed: 1,
	dropSize: 1,
	seed: 4,
	refraction: 1,
	offsetRange: 720,
	time: 1.5,
};

test('WetGlass fallback draws the droplet field at half size and returns it as a PNG data URL', () => {
	const {canvas, calls} = mockCanvas();
	const target = Object.assign(canvas, {
		width: 0,
		height: 0,
		toDataURL: (type: string) => `data:${type};base64,map`,
	});
	const renderer = loadWetGlass(target).createDropMapRenderer();
	assert.ok(renderer);

	assert.equal(renderer.draw(params), 'data:image/png;base64,map');
	assert.deepEqual([target.width, target.height], [640, 360]);
	assert.ok(calls.some((call) => call.name === 'drawArrays'));
	assert.deepEqual(calls.find((call) => call.name === 'viewport')?.args, [0, 0, 640, 360]);
	// The droplet field is laid out for the full-size element, not the smaller map.
	assert.deepEqual(calls.find((call) => call.name === 'uniform2f')?.args.slice(1), [1280, 720]);
});

test('WetGlass fallback releases its WebGL resources', () => {
	const {canvas, calls} = mockCanvas();
	const renderer = loadWetGlass(
		Object.assign(canvas, {toDataURL: () => ''}),
	).createDropMapRenderer();
	renderer?.dispose();
	for (const name of ['deleteBuffer', 'deleteVertexArray', 'deleteProgram', 'deleteShader']) {
		assert.ok(
			calls.some((call) => call.name === name),
			name,
		);
	}
});

test('WetGlass fallback cleans up and reports a failed shader link', () => {
	const {canvas, calls} = mockCanvas('link');
	assert.throws(() => loadWetGlass(canvas).createDropMapRenderer(), /linking failed/);
	assert.ok(calls.some((call) => call.name === 'deleteProgram'));
});

test('WetGlass fallback is skipped when WebGL2 is unavailable', () => {
	const canvas = {getContext: () => null};
	assert.equal(loadWetGlass(canvas).createDropMapRenderer(), null);
});

test('WetGlass shader and drop map share one droplet field', () => {
	const {fragmentShader, dropMapShader} = loadWetGlass({});
	for (const shader of [fragmentShader, dropMapShader]) {
		assert.equal(shader.match(/void wetField\(/g)?.length, 1);
		assert.match(
			shader,
			/wetField\(vUv, resolution, time, seed, amount, speed, dropSize, normal, clearGlass\);/,
		);
	}
});
