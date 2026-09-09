import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {StudioProtocolInternals} from '@remotion/studio-protocol';
import ts from 'typescript';
import {loadHelpers} from './helpers';

type Timing = {grainSeed: number; warpSeed: number; tracking: number};
const {vhsTiming, bounded, vhsSchema} = loadHelpers('vhs', [
	'vhsTiming',
	'bounded',
	'vhsSchema',
]) as {
	vhsTiming: (time: number, period: number) => Timing;
	bounded: (value: number, min: number, max: number, fallback: number) => number;
	vhsSchema: Record<string, {default: unknown; min?: number; max?: number}>;
};

test('VHS timing is independent of render order and composition FPS', () => {
	const expected = vhsTiming(48 / 30, 1.2);
	vhsTiming(1000, 2);
	vhsTiming(-20, 0.01);
	assert.deepEqual(vhsTiming(48 / 30, 1.2), expected);
	assert.deepEqual(vhsTiming(96 / 60, 1.2), expected);
	assert.notDeepEqual(vhsTiming(49 / 30, 1.2), expected);
	assert.deepEqual(vhsTiming(0.1 + 0.2, 1.2).grainSeed, vhsTiming(0.3, 1.2).grainSeed);
});

test('VHS negative phase keeps filter seeds and tracking position bounded', () => {
	for (const time of [-86400, -15.2, -0.01, 0, 0.1, 86400]) {
		const {grainSeed, warpSeed, tracking} = vhsTiming(time, 1.2);
		assert.ok(Number.isInteger(grainSeed) && grainSeed >= 0 && grainSeed < 65521);
		assert.ok(Number.isInteger(warpSeed) && warpSeed >= 0 && warpSeed < 65521);
		assert.ok(tracking >= 0 && tracking < 1);
	}
});

test('VHS numeric controls clamp non-finite and out-of-range values', () => {
	assert.equal(bounded(NaN, 0, 1, 0.5), 0.5);
	assert.equal(bounded(Infinity, 0, 1, 0.5), 0.5);
	assert.equal(bounded(-1, 0, 1, 0.5), 0);
	assert.equal(bounded(2, 0, 1, 0.5), 1);
	for (const field of Object.values(vhsSchema)) {
		if (typeof field.default !== 'number') continue;
		if (field.min !== undefined) assert.ok(field.default >= field.min);
		if (field.max !== undefined) assert.ok(field.default <= field.max);
	}
	assert.ok(!('dateText' in vhsSchema));
	assert.equal(vhsSchema.strength.default, 1);
});

test('VHS ships standalone without demo children or audio dependencies', () => {
	const source = readFileSync('src/elements/vhs/vhs.tsx', 'utf8');
	assert.equal(readFileSync('dist/elements/vhs.tsx', 'utf8'), source);
	assert.equal(StudioProtocolInternals.getElementComponentNameFromSourceCode(source), 'Vhs');
	const file = ts.createSourceFile(
		'vhs.tsx',
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const imports = file.statements
		.filter(ts.isImportDeclaration)
		.map((node) => (node.moduleSpecifier as ts.StringLiteral).text);
	assert.deepEqual(imports, ['react', 'remotion']);
	const exports = file.statements.filter(
		(node) =>
			ts.canHaveModifiers(node) &&
			ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
	);
	assert.equal(exports.length, 1);
	const catalog = JSON.parse(readFileSync('dist/catalog.json', 'utf8')) as {slug: string}[];
	assert.ok(catalog.some(({slug}) => slug === 'vhs'));
	const payload = StudioProtocolInternals.parseStudioElementPayload(
		JSON.parse(readFileSync('dist/payloads/vhs.json', 'utf8')),
	);
	assert.ok(payload);
	assert.deepEqual(payload.element.dependencies, []);
	assert.equal(payload.element.sourceCode, source);
	assert.doesNotMatch(source, /LATE NIGHT SIGNAL|demo-track|<Space|<Halo/);
	assert.doesNotMatch(source, /Math\.random|Date\.now|requestAnimationFrame|setInterval/);
});
