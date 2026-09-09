import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElementPayload} from '@remotion/studio-protocol';
import ts from 'typescript';
import {catalog} from '../src/catalog';
import {sourceSettings} from './source-settings';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(workspace, 'dist');

await rm(dist, {recursive: true, force: true});
await mkdir(path.join(dist, 'elements'), {recursive: true});
await mkdir(path.join(dist, 'payloads'), {recursive: true});

for (const entry of catalog) {
	const sourceCode = await readFile(
		path.join(workspace, 'src/elements', entry.slug, `${entry.slug}.tsx`),
		'utf8',
	);
	const payload = createElementPayload({
		displayName: entry.name.replace(/([a-z])([A-Z])/g, '$1 $2'),
		slug: `banger-elements/${entry.slug}`,
		sourceCode,
		dependencies: [
			{name: '@remotion/media', version: null},
			{name: '@remotion/media-utils', version: null},
		],
		dimensions: {width: entry.width, height: entry.height},
		durationInFrames: 480,
		installationMode: 'component-owned-sequence',
	});
	await writeFile(path.join(dist, 'elements', `${entry.slug}.tsx`), sourceCode);
	await writeFile(
		path.join(dist, 'payloads', `${entry.slug}.json`),
		JSON.stringify({...payload, sourceSettings: sourceSettings(sourceCode)}),
	);
	console.log(`${entry.name}: ${sourceCode.length.toLocaleString()} characters`);
}

await writeFile(
	path.join(dist, 'components.ts'),
	`${catalog
		.map((entry) => `export {${entry.name}} from './elements/${entry.slug}';`)
		.join('\n')}\n`,
);
await writeFile(path.join(dist, 'catalog.json'), `${JSON.stringify(catalog)}\n`);

const consumer = ts.createProgram(
	catalog.map((entry) => path.join(dist, 'elements', `${entry.slug}.tsx`)),
	{
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		jsx: ts.JsxEmit.ReactJSX,
		strict: true,
		esModuleInterop: true,
		skipLibCheck: true,
		noEmit: true,
	},
);
const errors = ts.getPreEmitDiagnostics(consumer);
if (errors.length) {
	throw new Error(
		ts.formatDiagnosticsWithColorAndContext(errors, {
			getCanonicalFileName: (file) => file,
			getCurrentDirectory: () => workspace,
			getNewLine: () => '\n',
		}),
	);
}

console.log(`Built ${catalog.length} standalone Elements and validated Studio payloads.`);
