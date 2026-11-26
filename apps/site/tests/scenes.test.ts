import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {
	buildScene,
	finishes,
	formats,
	initialState,
	type Finish,
	type Format,
	type SceneSpec,
	type SceneState,
} from '../src/components/scenes/model';
import {printScene} from '../src/components/scenes/print';
import {scenes} from '../src/components/scenes/scenes';
import {sceneElements} from '../src/components/scenes/elements';
import {loadSceneElements, loadedElements} from '../src/components/scenes/lazy-elements';
import {
	CLIP_LEAD_SECONDS,
	CLIP_TAIL_SECONDS,
	SCENE_FPS,
	sceneClip,
	sceneFrames,
	sceneStart,
	sceneTimings,
	tracks,
} from '../src/components/scenes/timing';
import {DEMO_SONG} from '../src/components/recipes/recipes';
import waves from '../src/components/scenes/waves.json';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allFormats = Object.keys(formats) as Format[];
const allFinishes = Object.keys(finishes) as Finish[];

const variants = (spec: SceneSpec): SceneState[] =>
	allFormats.flatMap((format) =>
		allFinishes.flatMap((finish) =>
			[[], ...spec.layers.slice(0, -1).map((layer) => [layer.slug])].map((hidden) => ({
				...initialState(spec),
				format,
				finish,
				hidden,
			})),
		),
	);

test('every scene timing has one scene, with its own component name', () => {
	assert.deepEqual(
		scenes.map((spec) => spec.timing.id),
		sceneTimings.map((timing) => timing.id),
	);
	const components = scenes.map((spec) => spec.timing.component);
	assert.equal(new Set(components).size, components.length);
	for (const component of components) assert.match(component, /^[A-Z][A-Za-z]+$/);
});

test('the copied code imports exactly the elements it renders', () => {
	for (const spec of scenes) {
		for (const state of variants(spec)) {
			const built = buildScene(spec, state);
			const code = printScene(built);
			const imported = [...code.matchAll(/^import \{\w+\} from '\.\/([\w-]+)\.element';$/gm)].map(
				(match) => match[1],
			);
			assert.deepEqual([...imported].sort(), [...built.elements].sort(), spec.timing.id);
			const hidden = state.hidden[0];
			if (hidden) assert.ok(!built.elements.includes(hidden), `${spec.timing.id} hides ${hidden}`);
			if (state.finish !== 'none') assert.ok(built.elements.includes(state.finish));
		}
	}
});

test('exactly one layer plays the track, whichever layers are on', () => {
	for (const spec of scenes) {
		for (const state of variants(spec)) {
			const code = printScene(buildScene(spec, state));
			assert.equal(
				(code.match(/\bplayAudio\b(?!\s*[:=])/g) ?? []).length,
				1,
				`${spec.timing.id} ${state.format} ${state.finish} ${state.hidden.join()}`,
			);
		}
	}
});

test('palette and energy reach the props', () => {
	for (const spec of scenes) {
		const calm = printScene(buildScene(spec, {...initialState(spec), energy: 0}));
		const loud = printScene(buildScene(spec, {...initialState(spec), energy: 1}));
		assert.notEqual(calm, loud, `${spec.timing.id} reacts to energy`);
		spec.palettes.forEach((palette, index) => {
			const code = printScene(buildScene(spec, {...initialState(spec), palette: index}));
			assert.ok(code.includes(palette.a) || code.includes(palette.b), `${palette.name} is used`);
		});
	}
});

test('the live preview is the copied composition at a smaller size', () => {
	for (const spec of scenes) {
		const state = {...initialState(spec), format: 'tall' as const};
		const full = buildScene(spec, state);
		const small = buildScene(spec, state, {width: 720, height: 1280});
		assert.deepEqual(small.elements, full.elements);
		assert.equal(small.durationInFrames, full.durationInFrames);
		assert.equal(small.start, full.start);
	}
});

test('every scene has a waveform of its loop', () => {
	const levels = waves as Record<string, number[]>;
	for (const timing of sceneTimings) {
		const wave = levels[timing.id];
		assert.ok(wave, timing.id);
		assert.equal(wave.length, 256);
		assert.ok(wave.every((level) => level >= 0 && level <= 1));
		assert.equal(Math.max(...wave), 1);
	}
});

test('the copied code type-checks against the elements', () => {
	const dir = path.join(site, 'tests/.scenes');
	const components = path.resolve(site, '../../packages/elements/dist/components');
	const files = new Map<string, string>();
	for (const spec of scenes) {
		for (const finish of allFinishes) {
			const built = buildScene(spec, {...initialState(spec), finish});
			files.set(path.join(dir, `${spec.timing.id}-${finish}.tsx`), printScene(built));
			for (const slug of built.elements) {
				const name = printScene(built).match(
					new RegExp(`import \\{(\\w+)\\} from '\\./${slug}\\.element'`),
				)![1];
				files.set(path.join(dir, `${slug}.element.ts`), `export {${name}} from '${components}';\n`);
			}
		}
	}
	const config = ts.getParsedCommandLineOfConfigFile(
		path.join(site, 'tsconfig.json'),
		{},
		{...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {}},
	)!;
	const host = ts.createCompilerHost(config.options);
	const read = host.readFile.bind(host);
	const exists = host.fileExists.bind(host);
	host.readFile = (file) => files.get(path.resolve(file)) ?? read(file);
	host.fileExists = (file) => files.has(path.resolve(file)) || exists(file);
	const directory = host.directoryExists?.bind(host);
	host.directoryExists = (name) => path.resolve(name) === dir || (directory?.(name) ?? false);
	const roots = [...files.keys()].filter((file) => file.endsWith('.tsx'));
	const program = ts.createProgram(roots, {...config.options, noEmit: true}, host);
	const problems = roots
		.flatMap((file) => ts.getPreEmitDiagnostics(program, program.getSourceFile(file)))
		.map((diagnostic) => {
			const where = diagnostic.file
				? `${path.basename(diagnostic.file.fileName)}:${
						diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1
					}`
				: '';
			return `${where} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`;
		});
	assert.deepEqual(problems, []);
});

test('each scene plays an excerpt that keeps the track timeline and holds the whole loop', () => {
	for (const timing of sceneTimings) {
		const clip = sceneClip(timing);
		const start = sceneStart(timing);
		const loop = sceneFrames(timing) / SCENE_FPS;
		assert.ok(clip.from >= 0 && clip.from <= start, timing.id);
		assert.ok(start - clip.from <= CLIP_LEAD_SECONDS + 0.011, timing.id);
		assert.ok(clip.from + clip.seconds >= start + loop + CLIP_TAIL_SECONDS - 0.011, timing.id);
		if (start < CLIP_LEAD_SECONDS) assert.equal(clip.from, 0, timing.id);

		const file = path.join(site, 'static', clip.src);
		assert.ok(existsSync(file), `${clip.src} is generated by scripts/clips.mjs`);
		assert.ok(statSync(file).size < 800 * 1024, `${clip.src} stays small`);
	}
});

test('the full tracks are site files, and the recipes use the same demo song', () => {
	for (const track of Object.values(tracks)) {
		assert.ok(existsSync(path.join(site, 'static', track.asset)), track.asset);
	}
	assert.equal(DEMO_SONG, tracks.demo.asset);
});

test('the tuner has its excerpt and a waveform that needs no decoding', () => {
	assert.ok(existsSync(path.join(site, 'static/audio/tuner.mp3')));
	const wave = JSON.parse(
		readFileSync(path.join(site, 'src/components/tuner-wave.json'), 'utf8'),
	) as number[];
	assert.equal(wave.length, 512);
	assert.equal(Math.max(...wave), 1);
});

test('every element a scene can draw loads lazily, and renders get the same set', async () => {
	const slugs = new Set(
		scenes.flatMap((spec) => variants(spec).flatMap((state) => buildScene(spec, state).elements)),
	);
	assert.ok(slugs.has('waveform'), 'the after-hours overlay draws a waveform');
	await loadSceneElements([...slugs]);
	for (const slug of slugs) {
		assert.ok(loadedElements[slug], slug);
		assert.equal(loadedElements[slug], (sceneElements as Record<string, unknown>)[slug], slug);
	}
	await assert.rejects(async () => loadSceneElements(['not-an-element']), /not registered/);
});

test('every poster has a filmstrip thumbnail and an icon', () => {
	const posters = path.join(site, 'static/posters');
	const full = readdirSync(posters).filter((file) => file.endsWith('.webp'));
	assert.ok(full.length > 0);
	for (const file of full) {
		for (const dir of ['thumbs', 'icons']) {
			const small = path.join(posters, dir, file);
			assert.ok(existsSync(small), `${dir}/${file} comes from scripts/poster-sizes.mjs`);
			assert.ok(statSync(small).size < statSync(path.join(posters, file)).size, `${dir}/${file}`);
		}
	}
});
