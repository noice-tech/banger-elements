import type {ComponentProps} from 'react';
import type {sceneElements, SceneElementSlug} from './elements';
import {box, br, fill, type LayerSpec, type SceneContext, type SceneSpec} from './model';
import {sceneTimings} from './timing';

type LayerProps<S extends SceneElementSlug> = Omit<
	ComponentProps<(typeof sceneElements)[S]>,
	'audioSrc' | 'audioOffsetInSeconds' | 'playAudio' | 'width' | 'height' | 'children' | 'style'
>;

type LayerFor = {
	[S in SceneElementSlug]: {
		readonly slug: S;
		readonly props: (ctx: SceneContext) => Partial<LayerProps<S>>;
	};
}[SceneElementSlug];

const layer = (spec: LayerFor): LayerSpec => spec as unknown as LayerSpec;

const timing = (id: string) => sceneTimings.find((entry) => entry.id === id)!;

/**
 * Shaders lay out against the frame height, so a size picked for 16:9 is
 * scaled down on a tall frame to keep the same share of its width.
 */
const span = ({W, H}: SceneContext, size: number) =>
	Math.round(((size * Math.min(W, H)) / H) * 100) / 100;

const shadow = (color: string) => `0 2px 28px ${color}`;

export const scenes: readonly SceneSpec[] = [
	{
		timing: timing('time-travel'),
		title: 'Time Travel',
		use: 'Release teaser',
		about: 'A release teaser for Time Travel by Tequila Funk, from where the band comes back in',
		background: '#07020f',
		palettes: [
			{name: 'Outrun', a: '#9333ea', b: '#ff2bd6', c: '#36d6ff'},
			{name: 'Sunset', a: '#ff4d2e', b: '#ffb13b', c: '#ff3d8b'},
			{name: 'Chrome', a: '#2b59ff', b: '#9ad8ff', c: '#ffffff'},
			{name: 'Acid', a: '#0f9d58', b: '#c6ff3d', c: '#ff5cf0'},
		],
		finish: 'vhs',
		layers: [
			layer({
				slug: 'synthwave',
				props: ({palette, energy, track}) => ({
					startColor: palette.a,
					endColor: palette.b,
					hideSphere: true,
					bpm: track.bpm,
					responsive: energy(1, 3, 1),
					inputGainDb: energy(-9, 3, 1),
				}),
			}),
			layer({
				slug: 'circle',
				props: (ctx) => ({
					circleVariant: 'glow-ring',
					startColor: ctx.palette.b,
					endColor: ctx.palette.c,
					radius: span(ctx, 0.4),
					lineWidth: 2,
					intensity: ctx.energy(1.5, 4),
					inputGainDb: ctx.energy(-6, 4, 1),
				}),
			}),
			layer({
				slug: 'audio-particles',
				props: (ctx) => ({
					color: ctx.palette.c,
					radius: span(ctx, 0.42),
					density: ctx.energy(16, 40, 1),
					intensity: ctx.energy(2, 7),
					size: 1.3,
				}),
			}),
		],
		overlay: ({px}) => [
			fill(
				{
					justifyContent: 'flex-end',
					alignItems: 'center',
					paddingBottom: px(52),
					textAlign: 'center',
					textShadow: shadow('rgb(10 0 30 / 0.85)'),
				},
				box({fontSize: px(20), fontWeight: 600, letterSpacing: px(10)}, 'TEQUILA FUNK'),
				box(
					{
						marginTop: px(10),
						fontSize: px(112),
						fontWeight: 300,
						lineHeight: 0.95,
						letterSpacing: -px(3),
					},
					'Time Travel',
				),
				box(
					{marginTop: px(18), fontSize: px(18), fontWeight: 600, letterSpacing: px(8)},
					'OUT NOW',
				),
			),
		],
	},
	{
		timing: timing('breakdown'),
		title: 'Breakdown',
		use: 'Visualizer upload',
		about:
			'A visualizer for the breakdown of Time Travel by Tequila Funk, where the bass drops out',
		background: '#04030a',
		palettes: [
			{name: 'Violet', a: '#7c3aed', b: '#c4b5fd', c: '#51e8cc'},
			{name: 'Ember', a: '#ff5a1f', b: '#ffd2a8', c: '#ffe14d'},
			{name: 'Ocean', a: '#1e6bff', b: '#bfe3ff', c: '#7cf3ff'},
			{name: 'Rose', a: '#ff2b8a', b: '#ffd1e8', c: '#ffffff'},
		],
		finish: 'fisheye',
		layers: [
			layer({
				slug: 'hyperloop',
				props: ({palette, energy}) => ({
					baseColor: palette.a,
					speed: energy(1, 2.5, 0.25),
					responsive: energy(1, 6, 0.5),
					inputGainDb: 0,
				}),
			}),
			layer({
				slug: 'oscilloscope',
				props: ({palette, energy}) => ({
					lineColor: palette.c,
					lineWidth: 3,
					displayMode: 'single-cycle',
					amplitude: energy(0.5, 1.5),
					inputGainDb: energy(-6, 2, 1),
				}),
			}),
		],
		overlay: ({px, palette}) => [
			box(
				{
					position: 'absolute',
					left: px(56),
					bottom: px(52),
					textShadow: shadow('rgb(0 0 0 / 0.6)'),
				},
				box({fontSize: px(46), fontWeight: 700, letterSpacing: -px(1.5)}, 'Time Travel'),
				box({marginTop: px(6), fontSize: px(22), color: palette.b}, 'Tequila Funk'),
			),
		],
	},
	{
		timing: timing('the-drop'),
		title: 'The Drop',
		use: 'Event promo',
		about: 'An event promo cut to the drop of the Banger demo song',
		background: '#05010c',
		palettes: [
			{name: 'Club', a: '#6b6bff', b: '#ff2bd6', c: '#ffcc88'},
			{name: 'Heat', a: '#ff5a3c', b: '#ffcc00', c: '#fff1d6'},
			{name: 'Laser', a: '#2bd9a8', b: '#5b6bff', c: '#e8fff6'},
			{name: 'Ultraviolet', a: '#8b5cf6', b: '#22d3ee', c: '#fde7ff'},
		],
		finish: 'none',
		layers: [
			layer({
				slug: 'cathedral',
				props: ({palette, energy, track}) => ({
					stoneColor: palette.a,
					glassColor1: palette.c,
					glassColor2: palette.b,
					lightColor: palette.c,
					bpm: track.bpm,
					speed: energy(0.4, 1, 0.05),
					glassGlow: energy(1.5, 3, 0.25),
					responsive: energy(1, 3, 0.5),
					inputGainDb: 0,
				}),
			}),
			layer({
				slug: 'spectre',
				props: ({palette, energy}) => ({
					spectreVariant: 'segmented',
					startColor: palette.b,
					endColor: palette.c,
					bottom: true,
					count: 48,
					intensity: energy(1.5, 3.5),
					inputGainDb: energy(-2, 4, 1),
				}),
			}),
		],
		overlay: ({px}) => [
			fill(
				{
					alignItems: 'center',
					justifyContent: 'center',
					textAlign: 'center',
					textShadow: shadow('rgb(30 0 40 / 0.7)'),
				},
				box({fontSize: px(22), fontWeight: 600, letterSpacing: px(12)}, 'BANGER NIGHT'),
				box(
					{
						marginTop: px(8),
						fontSize: px(150),
						fontWeight: 900,
						lineHeight: 0.88,
						letterSpacing: -px(7),
					},
					'FRI',
					br,
					'21.11',
				),
				box(
					{marginTop: px(20), fontSize: px(20), fontWeight: 600, letterSpacing: px(8)},
					'DOORS 23:00 · BERLIN',
				),
			),
		],
	},
	{
		timing: timing('after-hours'),
		title: 'After Hours',
		use: 'Stream background',
		about: 'A stream background for the Banger demo song, with a now-playing card',
		background: '#06040e',
		palettes: [
			{name: 'Dusk', a: '#c21aff', b: '#ffbb88', c: '#f3e8ff'},
			{name: 'Moonlight', a: '#3b82f6', b: '#bfdbfe', c: '#eff6ff'},
			{name: 'Neon', a: '#ff2b6b', b: '#2bffd5', c: '#fff0f5'},
			{name: 'Gold', a: '#d97706', b: '#fde68a', c: '#fffbeb'},
		],
		finish: 'wet-glass',
		layers: [
			layer({
				slug: 'moon',
				props: ({palette, energy}) => ({
					startColor: palette.a,
					stars: 12,
					speed: 0.25,
					responsive: energy(0.8, 2.4),
					inputGainDb: 0,
				}),
			}),
		],
		overlay: (ctx) => {
			const {px, palette, track} = ctx;
			return [
				box(
					{position: 'absolute', left: px(56), top: px(52), textShadow: shadow('rgb(0 0 0 / 0.5)')},
					box({fontSize: px(16), letterSpacing: px(6), opacity: 0.8}, 'LIVE · 02:14 AM'),
					box(
						{
							marginTop: px(12),
							fontSize: px(66),
							fontWeight: 800,
							lineHeight: 0.95,
							letterSpacing: -px(2),
						},
						'after',
						br,
						'hours',
					),
				),
				box(
					{
						position: 'absolute',
						left: px(56),
						bottom: px(52),
						display: 'flex',
						alignItems: 'center',
						gap: px(20),
						padding: `${px(14)}px ${px(20)}px`,
						borderRadius: px(18),
						background: 'rgb(12 10 22 / 0.62)',
						border: '1px solid rgb(255 255 255 / 0.12)',
					},
					box({
						width: px(52),
						height: px(52),
						borderRadius: px(10),
						background: `linear-gradient(140deg, ${palette.b}, ${palette.a})`,
					}),
					box(
						undefined,
						box({fontSize: px(12), letterSpacing: px(3), opacity: 0.65}, 'NOW PLAYING'),
						box(
							{marginTop: px(4), fontSize: px(20), fontWeight: 600},
							`${track.artist} — ${track.title}`,
						),
					),
					ctx.element('waveform', {
						width: px(200),
						height: px(48),
						color: palette.b,
						windowInSeconds: 1.5,
					}),
				),
			];
		},
	},
];

export const sceneById = (id: string) => scenes.find((scene) => scene.timing.id === id)!;
