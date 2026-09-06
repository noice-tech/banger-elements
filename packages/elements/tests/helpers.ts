import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as MediaUtils from '@remotion/media-utils';
import * as Media from '@remotion/media';

// Expose private helpers only in memory: shipped Elements remain standalone.
export function loadHelpers(
	element: string,
	names: string[],
	overrides: Record<string, unknown> = {},
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
					if (name === 'createShader') return {shader: ++shaderCount};
					if (name === 'getShaderParameter')
						return !(failure === 'vertex' || (failure === 'fragment' && shaderCount === 2));
					if (name === 'getProgramParameter') return failure !== 'link';
					if (name === 'createVertexArray' && failure === 'vao') return null;
					if (name === 'createBuffer') {
						bufferCount++;
						return failure === 'first-buffer' || (failure === 'second-buffer' && bufferCount === 2)
							? null
							: {buffer: bufferCount};
					}
					if (name === 'createTexture') {
						textureCount++;
						return failure === 'texture' || (failure === 'second-texture' && textureCount === 2)
							? null
							: {texture: textureCount};
					}
					if (name.startsWith('create')) return {name};
					if (name === 'getUniformLocation') return args[1];
					if (name === 'getAttribLocation') return 0;
					if (name === 'getError')
						return failure === 'draw' ? -1 : (constants.get('NO_ERROR') ?? constants.size + 1);
					return null;
				};
			},
		},
	);
	return {canvas: {getContext: () => gl} as unknown as HTMLCanvasElement, calls, constants};
}
