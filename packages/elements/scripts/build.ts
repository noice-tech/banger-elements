import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElementPayload, staticFileRef} from '@remotion/studio-protocol';
import ts from 'typescript';
import {catalog} from '../src/catalog';
import {schemaFields, type SchemaField} from './schema-fields';
import {sourceSettings} from './source-settings';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(workspace, 'dist');

const downloads = [
	{
		path: 'banger-elements/remotion-made-this-picture-move.mp3',
		type: 'url',
		url: 'https://remotion.media/elements/remotion-made-this-picture-move.mp3',
	},
	{
		path: 'banger-elements/rain.jpg',
		type: 'url',
		url: 'https://cdn.banger.show/assets/rain.jpg',
	},
] as const;

function installedAssets(slug: string, settings: ReturnType<typeof sourceSettings>) {
	const props = Object.entries(settings).flatMap(([prop, {value}]) => {
		if (typeof value !== 'string' || !/^https?:\/\//.test(value)) return [];
		const asset = downloads.find((download) => download.url === value);
		if (!asset) throw new Error(`${slug}: add ${value} to downloads so Studio copies it`);
		return [{prop, asset}];
	});
	return {
		assets: props.map(({asset}) => asset),
		initialProps: props.length
			? Object.fromEntries(props.map(({prop, asset}) => [prop, staticFileRef(asset.path)]))
			: null,
	};
}

await rm(dist, {recursive: true, force: true});
await mkdir(path.join(dist, 'elements'), {recursive: true});
await mkdir(path.join(dist, 'payloads'), {recursive: true});

const fields: Record<string, SchemaField[]> = {};
for (const entry of catalog) {
	const sourceCode = await readFile(
		path.join(workspace, 'src/elements', entry.slug, `${entry.slug}.tsx`),
		'utf8',
	);
	const settings = sourceSettings(sourceCode);
	const fillsComposition = sourceCode.includes(`layout: 'absolute-fill'`);
	const payload = createElementPayload({
		displayName: entry.slug === 'vhs' ? 'VHS' : entry.name.replace(/([a-z])([A-Z])/g, '$1 $2'),
		slug: `banger-elements/${entry.slug}`,
		sourceCode,
		dependencies:
			entry.category === 'effects'
				? []
				: [
						{name: '@remotion/media', version: null},
						{name: '@remotion/media-utils', version: null},
					],
		dimensions: fillsComposition ? null : {width: entry.width, height: entry.height},
		durationInFrames: 480,
		installationMode: 'component-owned-sequence',
		...installedAssets(entry.slug, settings),
	});
	fields[entry.slug] = schemaFields(sourceCode);
	await writeFile(path.join(dist, 'elements', `${entry.slug}.tsx`), sourceCode);
	await writeFile(
		path.join(dist, 'payloads', `${entry.slug}.json`),
		JSON.stringify({...payload, sourceSettings: settings}),
	);
	console.log(`${entry.name}: ${sourceCode.length.toLocaleString()} characters`);
}
await writeFile(path.join(dist, 'fields.json'), `${JSON.stringify(fields)}\n`);

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
