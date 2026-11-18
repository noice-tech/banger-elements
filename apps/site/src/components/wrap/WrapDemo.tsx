// Stack the wrapped and plain versions so the page can compare them in sync.
import type {CSSProperties, FC, ReactNode} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Fisheye, Vhs, WetGlass} from '../../../../../packages/elements/dist/components';
import {
	WRAP_FPS,
	WRAP_FRAMES,
	WRAP_HEIGHT as H,
	WRAP_WIDTH as W,
	wrapDemos,
	type WrapEffect,
} from './demos';

const MONO = '"Geist Mono", ui-monospace, monospace';
const SANS = 'Geist, Inter, system-ui, sans-serif';

// Use whole cycles of this phase to keep motion seamless.
const useLoop = () => useCurrentFrame() / WRAP_FRAMES;
const TURN = Math.PI * 2;

// A fixed scatter, so every render places the lights the same way.
const scatter = (index: number) => {
	const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
	return value - Math.floor(value);
};

const lightColors = ['#ffb35c', '#ff5f7e', '#ffd98a', '#6fd0ff', '#b98bff', '#ff8a3d'];
const lights = Array.from({length: 46}, (_, index) => ({
	x: scatter(index) * W,
	y: H * 0.18 + scatter(index + 40) * H * 0.62,
	size: 24 + scatter(index + 80) ** 2 * 150,
	color: lightColors[Math.floor(scatter(index + 120) * lightColors.length)]!,
	phase: scatter(index + 160) * TURN,
	cycles: 1 + Math.floor(scatter(index + 200) * 3),
}));

const CityLights = () => {
	const loop = useLoop();
	return (
		<AbsoluteFill
			style={{background: 'linear-gradient(180deg, #05040c 0%, #160a26 55%, #3a1530 100%)'}}
		>
			{lights.map((light, index) => {
				const swing = Math.sin(loop * TURN + light.phase);
				const twinkle = Math.sin(loop * TURN * light.cycles + light.phase);
				return (
					<div
						key={index}
						style={{
							position: 'absolute',
							left: light.x - light.size / 2 + swing * 26,
							top: light.y - light.size / 2,
							width: light.size,
							height: light.size,
							borderRadius: '50%',
							background: `radial-gradient(circle, ${light.color} 0%, ${light.color} 42%, transparent 72%)`,
							opacity: 0.68 + twinkle * 0.28,
						}}
					/>
				);
			})}
			<div
				style={{
					position: 'absolute',
					insetInline: 0,
					bottom: 64,
					color: '#fff',
					fontFamily: SANS,
					textAlign: 'center',
				}}
			>
				<div style={{fontFamily: MONO, fontSize: 18, letterSpacing: 4, opacity: 0.7}}>02:14 AM</div>
				<div style={{marginTop: 8, fontSize: 96, fontWeight: 300, letterSpacing: -3}}>
					Night drive
				</div>
			</div>
		</AbsoluteFill>
	);
};

// SMPTE-style bars at 75%.
const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
const strip = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
const base = [
	['#00214c', 5],
	['#ffffff', 5],
	['#32006a', 5],
	['#131313', 6],
	['#090909', 1],
	['#131313', 1],
	['#1d1d1d', 1],
	['#131313', 4],
] as const;

const ColorBars = () => (
	<AbsoluteFill style={{background: '#131313'}}>
		<div style={{display: 'flex', height: '67%'}}>
			{bars.map((color) => (
				<div key={color} style={{flex: 1, background: color}} />
			))}
		</div>
		<div style={{display: 'flex', height: '8%'}}>
			{strip.map((color, index) => (
				<div key={index} style={{flex: 1, background: color}} />
			))}
		</div>
		<div style={{display: 'flex', flex: 1}}>
			{base.map(([color, share], index) => (
				<div key={index} style={{flex: share, background: color}} />
			))}
		</div>
	</AbsoluteFill>
);

const osd: CSSProperties = {
	position: 'absolute',
	color: '#fff',
	fontFamily: MONO,
	fontSize: 38,
	fontWeight: 500,
	letterSpacing: 3,
	textShadow: '3px 3px 0 rgb(0 0 0 / 0.55)',
};

const Timecode = () => {
	const frame = useCurrentFrame() + (84 * 60 + 16) * WRAP_FPS;
	const seconds = Math.floor(frame / WRAP_FPS);
	const pad = (value: number) => String(value).padStart(2, '0');
	const time = `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
	return (
		<AbsoluteFill>
			<div style={{...osd, left: 64, top: 52}}>PLAY ▶</div>
			<div style={{...osd, right: 64, top: 52}}>SP</div>
			<div style={{...osd, left: 64, bottom: 52}}>{time}</div>
			<div style={{...osd, right: 64, bottom: 52}}>NOV.17 1996</div>
		</AbsoluteFill>
	);
};

// Geist Mono sets every glyph 0.6em wide, so a row's length is known up front
// and the scroll can turn exactly one length per loop.
const MARQUEE_SIZE = 96;
const MARQUEE_TRACK = 0.04;
const rows = [
	'SYNTHWAVE ✶ CATHEDRAL ✶ ',
	'HYPERLOOP ✶ MOON ✶ SPECTRE ✶ ',
	'FERROFLUID ✶ HALO ✶ TRIP ✶ ',
	'OSCILLOSCOPE ✶ CIRCLE ✶ ',
	'WET GLASS ✶ VHS ✶ FISHEYE ✶ ',
	'LIQUID ✶ PULSAR ✶ RAIN ✶ ',
];

const Marquee = () => {
	const loop = useLoop();
	const advance = MARQUEE_SIZE * (0.6 + MARQUEE_TRACK);
	return (
		<AbsoluteFill
			style={{
				background: '#0b0714',
				justifyContent: 'center',
				fontFamily: MONO,
				fontSize: MARQUEE_SIZE,
				fontWeight: 800,
				letterSpacing: `${MARQUEE_TRACK}em`,
				lineHeight: `${H / rows.length}px`,
				whiteSpace: 'pre',
			}}
		>
			{rows.map((text, index) => {
				const length = [...text].length * advance;
				const shift = (index % 2 === 0 ? -loop : loop - 1) * length;
				return (
					<div
						key={text}
						style={{
							transform: `translateX(${shift}px)`,
							color: index % 2 === 1 ? '#4a3a66' : index === 2 ? '#c38bff' : '#f4efe6',
						}}
					>
						{text.repeat(Math.ceil((W * 2) / length) + 1)}
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

const insides: Record<WrapEffect, FC> = {
	'wet-glass': CityLights,
	vhs: () => (
		<>
			<ColorBars />
			<Timecode />
		</>
	),
	fisheye: Marquee,
};

const effects = {'wet-glass': WetGlass, vhs: Vhs, fisheye: Fisheye} as const;

const Wrapped = ({slug, children}: {slug: WrapEffect; children: ReactNode}) => {
	const Effect: FC<{width: number; height: number; children: ReactNode}> = effects[slug];
	const {props} = wrapDemos.find((entry) => entry.slug === slug)!;
	return (
		<Effect width={W} height={H} {...props}>
			{children}
		</Effect>
	);
};

const half: CSSProperties = {
	position: 'absolute',
	left: 0,
	width: W,
	height: H,
	overflow: 'hidden',
};

export const WrapDemo = ({slug}: {slug: WrapEffect}) => {
	const Inside = insides[slug];
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<div style={{...half, top: 0}}>
				<Wrapped slug={slug}>
					<Inside />
				</Wrapped>
			</div>
			<div style={{...half, top: H}}>
				<Inside />
			</div>
		</AbsoluteFill>
	);
};
