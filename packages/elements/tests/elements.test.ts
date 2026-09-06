import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {setStudioDragData, StudioProtocolInternals} from '@remotion/studio-protocol';
import ts from 'typescript';
import {catalog} from '../src/catalog';

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
	dependencies: Record<string, string>;
};

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
	});
}

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
