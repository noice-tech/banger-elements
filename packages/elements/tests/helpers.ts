import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as MediaUtils from '@remotion/media-utils';
import * as Media from '@remotion/media';

export function loadHelpers(
	element: string,
	names: string[],
	overrides: Record<string, unknown> = {},
	globals: Record<string, unknown> = {},
) {
	const source = readFileSync(
		new URL(`../src/elements/${element}/${element}.tsx`, import.meta.url),
		'utf8',
	);
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
	const modules: Record<string, unknown> = {
		'@remotion/media': Media,
		'@remotion/media-utils': MediaUtils,
		...overrides,
	};
	runInNewContext(outputText, {
		...globals,
		exports,
		require: (name: string) => (name in modules ? modules[name] : require(name)),
	});
	return exports;
}

type Failure =
	| 'vertex'
	| 'fragment'
	| 'link'
	| 'vao'
	| 'first-buffer'
	| 'second-buffer'
	| 'texture'
	| 'second-texture'
	| 'draw';

export function mockCanvas(failure?: Failure) {
	const calls: {name: string; args: unknown[]}[] = [];
	const constants = new Map<string, number>();
	let shaderCount = 0,
		bufferCount = 0,
		textureCount = 0;
	const handlers: Record<string, (args: unknown[]) => unknown> = {
		createShader: () => ({shader: ++shaderCount}),
		getShaderParameter: () =>
			!(failure === 'vertex' || (failure === 'fragment' && shaderCount === 2)),
		getProgramParameter: () => failure !== 'link',
		createVertexArray: () => (failure === 'vao' ? null : {name: 'createVertexArray'}),
		createBuffer: () => {
			bufferCount++;
			return failure === 'first-buffer' || (failure === 'second-buffer' && bufferCount === 2)
				? null
				: {buffer: bufferCount};
		},
		createTexture: () => {
			textureCount++;
			return failure === 'texture' || (failure === 'second-texture' && textureCount === 2)
				? null
				: {texture: textureCount};
		},
		getUniformLocation: (args) => args[1],
		getAttribLocation: () => 0,
		getError: () => (failure === 'draw' ? -1 : (constants.get('NO_ERROR') ?? constants.size + 1)),
	};
	const gl = new Proxy(
		{},
		{
			get: (_, name: string) => {
				if (/^[A-Z_0-9]+$/.test(name)) {
					if (!constants.has(name)) constants.set(name, constants.size + 1);
					return constants.get(name);
				}
				return (...args: unknown[]) => {
					calls.push({name, args});
					if (Object.hasOwn(handlers, name)) return handlers[name]!(args);
					return name.startsWith('create') ? {name} : null;
				};
			},
		},
	);
	return {canvas: {getContext: () => gl} as unknown as HTMLCanvasElement, calls, constants};
}
