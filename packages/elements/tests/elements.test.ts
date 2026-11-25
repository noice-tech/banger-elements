import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {setStudioDragData, StudioProtocolInternals} from '@remotion/studio-protocol';
import ts from 'typescript';
import {catalog} from '../src/catalog';
import {loadHelpers} from './helpers';

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
	dependencies: Record<string, string>;
};

test('catalog: stable identities and explicit purpose-based categories', () => {
	assert.equal(new Set(catalog.map((entry) => entry.slug)).size, catalog.length);
	assert.equal(catalog.filter((entry) => entry.category === 'visualizers').length, 8);
	assert.deepEqual(
		catalog.filter((entry) => entry.category === 'effects').map((entry) => entry.slug),
		['vhs', 'fisheye', 'wet-glass'],
	);
	assert.deepEqual(
		catalog.filter((entry) => entry.category === 'shaders').map((entry) => entry.slug),
		[
			'trip',
			'space',
			'synthwave',
			'mushrooms',
			'fractals',
			'hyperloop',
			'downfall',
			'rail',
			'rain',
			'kaleidoscope',
			'eye',
			'flowers',
			'moon',
			'city',
			'basic',
			'pulse',
			'rooftop',
			'cathedral',
			'liquid',
			'chrome',
			'neuron',
			'matrix',
		],
	);
});

for (const entry of catalog) {
	test(`${entry.name}: standalone Element contract`, () => {
		const sourceCode = fs.readFileSync(`dist/elements/${entry.slug}.tsx`, 'utf8');
		const payload = StudioProtocolInternals.parseStudioElementPayload(
			JSON.parse(fs.readFileSync(`dist/payloads/${entry.slug}.json`, 'utf8')),
		);
		assert.ok(payload);
		assert.equal(payload.element.sourceCode, sourceCode);
		assert.equal(payload.element.slug, `banger-elements/${entry.slug}`);
		assert.equal(payload.element.installationMode, 'component-owned-sequence');
		assert.equal(
			StudioProtocolInternals.getElementComponentNameFromSourceCode(sourceCode),
			entry.name,
		);
		const file = ts.createSourceFile(
			'element.tsx',
			sourceCode,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		);
		const imports = file.statements
			.filter(ts.isImportDeclaration)
			.map((node) => (node.moduleSpecifier as ts.StringLiteral).text);
		assert.ok(!imports.some((dependency) => dependency.startsWith('.')));
		for (const dependency of imports) {
			const packageName = dependency.startsWith('@')
				? dependency.split('/').slice(0, 2).join('/')
				: dependency.split('/')[0];
			assert.ok(
				packageName in manifest.dependencies,
				`${dependency} must be a direct producer dependency`,
			);
		}
		const namedExports = file.statements.filter(
			(node) =>
				ts.canHaveModifiers(node) &&
				ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
		);
		assert.equal(namedExports.length, 1);
		assert.ok(
			payload.element.dependencies.every(
				(dependency) => !dependency.name.startsWith('@remotion/') || dependency.version === null,
			),
		);
		const fills = sourceCode.includes(`layout: 'absolute-fill'`);
		assert.equal(fills, entry.category === 'shaders');
		assert.deepEqual(
			payload.element.dimensions,
			fills ? null : {width: entry.width, height: entry.height},
		);
		if (entry.category === 'effects') {
			assert.deepEqual(payload.element.assets, []);
			assert.equal(payload.element.initialProps, null);
		} else {
			assert.equal(payload.element.assets.length, 1);
			StudioProtocolInternals.assertElementAssetReferences({
				assets: payload.element.assets,
				initialProps: payload.element.initialProps,
			});
			assert.deepEqual(Object.keys(payload.element.initialProps ?? {}), ['audioSrc']);
		}
	});
}

test('controls that only apply to one enum value are nested under that value', () => {
	const fields = JSON.parse(fs.readFileSync('dist/fields.json', 'utf8')) as Record<
		string,
		{name: string; shownWhen: {control: string; values: string[]} | null}[]
	>;
	const shownWhen = (slug: string, name: string) =>
		fields[slug]!.find((field) => field.name === name)?.shownWhen;
	assert.deepEqual(shownWhen('halo', 'startColor'), {control: 'colorMode', values: ['gradient']});
	assert.deepEqual(shownWhen('halo', 'artworkSrc'), {control: 'centerMode', values: ['filled']});
	assert.deepEqual(shownWhen('spectre', 'startColor'), {
		control: 'colorMode',
		values: ['gradient', 'gradient-3'],
	});
	assert.deepEqual(shownWhen('circle', 'count'), {
		control: 'circleVariant',
		values: ['radial-bars', 'dotted-ring'],
	});
	assert.deepEqual(shownWhen('waveform', 'color'), {control: 'colorMode', values: ['solid']});
	assert.deepEqual(shownWhen('oscilloscope', 'timeSpanMs'), {
		control: 'displayMode',
		values: ['pitch', 'free'],
	});
	assert.equal(shownWhen('circle', 'radius'), null);
	for (const entry of catalog) assert.ok(fields[entry.slug]!.length > 0, entry.slug);
});

test('Fisheye SVG fallback produces a deterministic displacement bitmap', () => {
	const {fisheyeDisplacementMap} = loadHelpers('fisheye', ['fisheyeDisplacementMap']) as {
		fisheyeDisplacementMap: (
			strength: number,
			perspectiveFactor: number,
			width: number,
			height: number,
		) => {uri: string; scale: number};
	};
	const first = fisheyeDisplacementMap(0.75, 0.35, 1280, 720);
	assert.deepEqual(first, fisheyeDisplacementMap(0.75, 0.35, 1280, 720));
	assert.notDeepEqual(first, fisheyeDisplacementMap(1.5, 0.35, 1280, 720));
	assert.ok(first.uri.startsWith('data:image/bmp;base64,Qk'));
	assert.ok(first.scale > 0);
});

test('drag transport round-trips through the Studio SDK', () => {
	const payload = StudioProtocolInternals.parseStudioElementPayload(
		JSON.parse(fs.readFileSync('dist/payloads/waveform.json', 'utf8')),
	)!;
	const values = new Map<string, string>();
	const transfer = {
		effectAllowed: 'none',
		setData: (type: string, value: string) => values.set(type, value),
		getData: (type: string) => values.get(type) ?? '',
		get types() {
			return [...values.keys()];
		},
	};
	setStudioDragData({
		dataTransfer: transfer as unknown as DataTransfer,
		payload,
	});
	assert.equal(transfer.effectAllowed, 'copy');
	const parsed = StudioProtocolInternals.parseDragData(transfer);
	assert.equal(parsed?.type, 'element');
	if (parsed?.type === 'element') {
		assert.equal(parsed.data.element.sourceCode, payload.element.sourceCode);
	}
});
