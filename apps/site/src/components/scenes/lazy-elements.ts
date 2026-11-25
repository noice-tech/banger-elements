import type {ComponentType} from 'react';
import type {SceneElementSlug} from './elements';

type AnyElement = ComponentType<Record<string, unknown>>;

const loaders: Record<SceneElementSlug, () => Promise<AnyElement>> = {
	'audio-particles': () =>
		import('../../../../../packages/elements/dist/elements/audio-particles').then(
			(m) => m.AudioParticles as unknown as AnyElement,
		),
	cathedral: () =>
		import('../../../../../packages/elements/dist/elements/cathedral').then(
			(m) => m.Cathedral as unknown as AnyElement,
		),
	circle: () =>
		import('../../../../../packages/elements/dist/elements/circle').then(
			(m) => m.Circle as unknown as AnyElement,
		),
	fisheye: () =>
		import('../../../../../packages/elements/dist/elements/fisheye').then(
			(m) => m.Fisheye as unknown as AnyElement,
		),
	hyperloop: () =>
		import('../../../../../packages/elements/dist/elements/hyperloop').then(
			(m) => m.Hyperloop as unknown as AnyElement,
		),
	moon: () =>
		import('../../../../../packages/elements/dist/elements/moon').then(
			(m) => m.Moon as unknown as AnyElement,
		),
	oscilloscope: () =>
		import('../../../../../packages/elements/dist/elements/oscilloscope').then(
			(m) => m.Oscilloscope as unknown as AnyElement,
		),
	spectre: () =>
		import('../../../../../packages/elements/dist/elements/spectre').then(
			(m) => m.Spectre as unknown as AnyElement,
		),
	synthwave: () =>
		import('../../../../../packages/elements/dist/elements/synthwave').then(
			(m) => m.Synthwave as unknown as AnyElement,
		),
	vhs: () =>
		import('../../../../../packages/elements/dist/elements/vhs').then(
			(m) => m.Vhs as unknown as AnyElement,
		),
	waveform: () =>
		import('../../../../../packages/elements/dist/elements/waveform').then(
			(m) => m.Waveform as unknown as AnyElement,
		),
	'wet-glass': () =>
		import('../../../../../packages/elements/dist/elements/wet-glass').then(
			(m) => m.WetGlass as unknown as AnyElement,
		),
};

/** Elements that have finished loading, by slug. Render only slugs you have awaited. */
export const loadedElements: Partial<Record<string, AnyElement>> = {};
const pending = new Map<string, Promise<void>>();

export const loadSceneElements = (slugs: readonly string[]): Promise<void> =>
	Promise.all(
		slugs.map((slug) => {
			if (loadedElements[slug]) return undefined;
			const load = loaders[slug as SceneElementSlug];
			if (!load) throw new Error(`Scene element not registered: ${slug}`);
			let request = pending.get(slug);
			if (!request) {
				request = load().then(
					(component) => {
						loadedElements[slug] = component;
					},
					(error: unknown) => {
						pending.delete(slug);
						throw error;
					},
				);
				pending.set(slug, request);
			}
			return request;
		}),
	).then(() => undefined);
