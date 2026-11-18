// The player and code printer consume the same tree from buildScene().
import catalog from '../../../../../packages/elements/dist/catalog.json';
import {
	SCENE_BARS,
	SCENE_FPS,
	sceneFrames,
	sceneStart,
	tracks,
	type SceneTiming,
	type Track,
} from './timing';

export type Format = 'wide' | 'square' | 'tall';

export const formats = {
	wide: {label: '16:9', width: 1280, height: 720},
	square: {label: '1:1', width: 1080, height: 1080},
	tall: {label: '9:16', width: 1080, height: 1920},
} as const satisfies Record<Format, {label: string; width: number; height: number}>;

export type Finish = 'none' | 'vhs' | 'wet-glass' | 'fisheye';

/** Finishes wrap the visual layers but leave the text overlay untouched. */
export const finishes = {
	none: {label: 'None', props: {}},
	vhs: {label: 'VHS', props: {strength: 0.75, glitch: 0.04, line: 0.25}},
	'wet-glass': {label: 'Wet Glass', props: {amount: 0.7, blur: 0.3, refraction: 1, seed: 7}},
	fisheye: {label: 'Fisheye', props: {strength: 0.6, perspectiveFactor: 0.35}},
} as const satisfies Record<Finish, {label: string; props: Record<string, number>}>;

export type Palette = {
	readonly name: string;
	readonly a: string;
	readonly b: string;
	readonly c: string;
};

/** A prop value the printer writes as code rather than as its value, like `W`. */
export type Expr = {readonly expr: string; readonly value: number};
export type PropValue = string | number | boolean | Expr;
export type Style = Readonly<Record<string, string | number>>;

export type ElementNode = {
	readonly kind: 'element';
	readonly slug: string;
	readonly name: string;
	/** Spreads the shared `audio` props: source, offset and the frame size. */
	readonly shared: boolean;
	/** The one layer that plays the track in a render. */
	readonly playAudio: boolean;
	readonly props: Readonly<Record<string, PropValue>>;
	readonly style?: Style;
	readonly children?: readonly SceneNode[];
};

export type BoxNode = {
	readonly kind: 'box';
	readonly tag: 'AbsoluteFill' | 'div' | 'span' | 'br';
	readonly style?: Style;
	readonly children?: readonly (SceneNode | string)[];
};

export type SceneNode = ElementNode | BoxNode;

export type SceneContext = {
	readonly W: number;
	readonly H: number;
	readonly format: Format;
	readonly palette: Palette;
	readonly track: Track;
	readonly energy: (calm: number, loud: number, step?: number) => number;
	/** A length designed against a 720 px short side, scaled to this format. */
	readonly px: (size: number) => number;
	readonly element: (slug: string, props: Record<string, PropValue>, style?: Style) => ElementNode;
};

export type LayerSpec = {
	readonly slug: string;
	readonly props: (ctx: SceneContext) => Readonly<Record<string, PropValue>>;
};

export type SceneSpec = {
	readonly timing: SceneTiming;
	readonly title: string;
	readonly use: string;
	/** The first line of the generated code. */
	readonly about: string;
	readonly background: string;
	readonly palettes: readonly Palette[];
	readonly finish: Finish;
	/** Back to front, inside the finish. */
	readonly layers: readonly LayerSpec[];
	readonly overlay: (ctx: SceneContext) => readonly SceneNode[];
};

export type SceneState = {
	readonly palette: number;
	/** 0 is calm, 1 is loud. */
	readonly energy: number;
	readonly finish: Finish;
	readonly format: Format;
	readonly hidden: readonly string[];
};

export const initialState = (spec: SceneSpec): SceneState => ({
	palette: 0,
	energy: 0.5,
	finish: spec.finish,
	format: 'wide',
	hidden: [],
});

export type BuiltScene = {
	readonly spec: SceneSpec;
	readonly track: Track;
	/** Seconds into the track. */
	readonly start: number;
	readonly fps: number;
	readonly bars: number;
	readonly durationInFrames: number;
	readonly width: number;
	readonly height: number;
	readonly root: BoxNode;
	/** Every element in the tree, back to front, once each. */
	readonly elements: readonly string[];
};

export const FONT = 'Geist, Inter, system-ui, sans-serif';
export const FILL: Style = {position: 'absolute', inset: 0};

const nameOf = new Map(catalog.map((entry) => [entry.slug, entry.name]));

export const elementName = (slug: string) => {
	const name = nameOf.get(slug);
	if (!name) throw new Error(`Unknown element: ${slug}`);
	return name;
};

const roundTo = (value: number, step: number) => {
	const digits = Math.max(0, -Math.floor(Math.log10(step)));
	return Number((Math.round(value / step) * step).toFixed(digits));
};

export const box = (style: Style | undefined, ...children: (SceneNode | string)[]): BoxNode => ({
	kind: 'box',
	tag: 'div',
	style,
	children,
});

export const fill = (style: Style | undefined, ...children: (SceneNode | string)[]): BoxNode => ({
	kind: 'box',
	tag: 'AbsoluteFill',
	style,
	children,
});

export const br: BoxNode = {kind: 'box', tag: 'br'};

const collect = (node: SceneNode | string, into: string[]) => {
	if (typeof node === 'string') return;
	if (node.kind === 'element' && !into.includes(node.slug)) into.push(node.slug);
	for (const child of node.children ?? []) collect(child, into);
};

export const buildScene = (
	spec: SceneSpec,
	state: SceneState,
	size: {readonly width: number; readonly height: number} = formats[state.format],
): BuiltScene => {
	const {width: W, height: H} = size;
	const track = tracks[spec.timing.track];
	const short = Math.min(W, H);
	const energy = Math.min(1, Math.max(0, state.energy));
	const ctx: SceneContext = {
		W,
		H,
		format: state.format,
		palette: spec.palettes[state.palette] ?? spec.palettes[0]!,
		track,
		energy: (calm, loud, step = 0.1) => roundTo(calm + (loud - calm) * energy, step),
		px: (size) => Math.round((size * short) / 720),
		element: (slug, props, style) => ({
			kind: 'element',
			slug,
			name: elementName(slug),
			shared: true,
			playAudio: false,
			props,
			style,
		}),
	};
	const visible = spec.layers.filter((layer) => !state.hidden.includes(layer.slug));
	const layers: ElementNode[] = visible.map((layer, index) => ({
		kind: 'element',
		slug: layer.slug,
		name: elementName(layer.slug),
		shared: true,
		playAudio: index === 0,
		props: layer.props(ctx),
		style: FILL,
	}));
	const stack: SceneNode[] =
		state.finish === 'none'
			? layers
			: [
					{
						kind: 'element',
						slug: state.finish,
						name: elementName(state.finish),
						shared: false,
						playAudio: false,
						props: {
							width: {expr: 'W', value: W},
							height: {expr: 'H', value: H},
							...finishes[state.finish].props,
						},
						children: layers,
					},
				];
	const root = fill(
		{background: spec.background, color: '#fff', fontFamily: FONT},
		...stack,
		...spec.overlay(ctx),
	);
	const elements: string[] = [];
	collect(root, elements);
	return {
		spec,
		track,
		start: sceneStart(spec.timing),
		fps: SCENE_FPS,
		bars: SCENE_BARS,
		durationInFrames: sceneFrames(spec.timing),
		width: W,
		height: H,
		root,
		elements,
	};
};
