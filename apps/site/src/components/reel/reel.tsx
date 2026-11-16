/*
 * The home page's closing reel: elements arranged into one beat-cut piece on
 * the demo song. `npm run reel` renders it to static/reel/reel.webm. The cut
 * list lives in scenes.ts, which the page's timeline reads too.
 */
import {useEffect, useState, type CSSProperties, type FC} from 'react';
import {
	AbsoluteFill,
	Sequence,
	continueRender,
	delayRender,
	interpolate,
	staticFile,
	useCurrentFrame,
} from 'remotion';
import {Audio} from '@remotion/media';
import {
	AudioParticles,
	Circle,
	Ferrofluid,
	Halo,
	Hyperloop,
	Liquid,
	Space,
	Spectre,
	Synthwave,
	Trip,
	Vhs,
	Waveform,
} from '../../../../../packages/elements/dist/components';
import {BAR, BEAT, REEL_FPS, REEL_FRAMES, SONG_FRAME, reelScenes} from './scenes';

const TRACK = 'https://cdn.banger.show/assets/banger-demo-song-min.mp3';
const W = 1280;
const H = 720;
const fill: CSSProperties = {position: 'absolute', inset: 0};
const DROP = reelScenes[1]!.from;
const MONTAGE = reelScenes[5]!.from;

/** Shared element props for a layer that starts `from` frames into the reel. */
const layer = (from: number) => ({
	audioSrc: TRACK,
	audioOffsetInSeconds: (SONG_FRAME + from) / REEL_FPS,
	playAudio: false,
	width: W,
	height: H,
	style: fill,
});

const Intro = ({from}: {from: number}) => {
	const frame = useCurrentFrame();
	const rise = interpolate(frame, [0, BAR * 0.85], [0, 1], {extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{transform: `scale(${1.18 - rise * 0.12})`, opacity: 0.15 + rise * 0.85}}>
			<Space {...layer(from)} baseColor="#6b4bff" speed={0.6} />
			<AbsoluteFill style={{justifyContent: 'center'}}>
				<Waveform
					{...layer(from)}
					height={H * 0.32}
					color="#fff4dc"
					intensity={0.8}
					style={{position: 'relative', opacity: 0.9}}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

const Drop = ({from}: {from: number}) => (
	<AbsoluteFill>
		<Hyperloop {...layer(from)} baseColor="#a020f0" speed={2.4} />
		<Halo {...layer(from)} colorMode="rainbow" centerMode="transparent" intensity={1.25} />
	</AbsoluteFill>
);

const Ride = ({from}: {from: number}) => (
	<AbsoluteFill>
		<Synthwave {...layer(from)} bpm={122} />
		<AudioParticles {...layer(from)} color="#ffc3f4" density={0.8} />
		<Spectre {...layer(from)} colorMode="rainbow" spectreVariant="segmented" count={48} />
	</AbsoluteFill>
);

const Tape = ({from}: {from: number}) => (
	<Vhs
		width={W}
		height={H}
		strength={0.85}
		horizontalDistortion={0.02}
		glitch={0.04}
		line={0.28}
		period={1.2}
	>
		<Trip {...layer(from)} bpm={122} />
		<Circle {...layer(from)} colorMode="rainbow" circleVariant="glow-ring" radius={0.5} />
	</Vhs>
);

const Metal = ({from}: {from: number}) => (
	<AbsoluteFill>
		<Liquid {...layer(from)} glowColor="#ff5a1f" bpm={122} />
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
			<Ferrofluid
				{...layer(from)}
				width={W * 1.25}
				height={H * 1.25}
				shineColor="#ffd2a8"
				style={{flex: 'none'}}
			/>
		</AbsoluteFill>
	</AbsoluteFill>
);

const scenes: Record<string, FC<{from: number}>> = {
	intro: Intro,
	drop: Drop,
	ride: Ride,
	tape: Tape,
	metal: Metal,
};
/** The last bar recaps a scene per beat. */
const montage = ['drop', 'ride', 'tape', 'metal'] as const;

const cuts = [
	...reelScenes
		.slice(1, 5)
		.map((scene) => ({at: scene.from, strength: scene.from === DROP ? 0.95 : 0.5})),
	...montage.map((_, beat) => ({at: Math.round(MONTAGE + beat * BEAT), strength: 0.3})),
];

const label: CSSProperties = {
	position: 'absolute',
	fontFamily: '"Geist Mono", ui-monospace, monospace',
	fontSize: 15,
	letterSpacing: '0.14em',
	textTransform: 'uppercase',
	color: '#fff4dc',
	textShadow: '0 1px 12px rgb(0 0 0 / 0.6)',
};

const Hud = () => {
	const frame = useCurrentFrame();
	const scene = [...reelScenes].reverse().find((candidate) => candidate.from <= frame)!;
	const bar = Math.floor((frame - DROP) / BAR) + 1;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{...label, left: 44, top: 38}}>Banger Elements</div>
			<div style={{...label, right: 44, top: 38, opacity: 0.75}}>
				{frame < DROP ? 'Count-in' : `Bar ${String(bar).padStart(2, '0')} / 08`}
			</div>
			<div style={{...label, left: 44, bottom: 38}}>{scene.layers.join(' × ')}</div>
			<div style={{...label, right: 44, bottom: 38, opacity: 0.75}}>122 BPM</div>
		</AbsoluteFill>
	);
};

const useFont = () => {
	const [handle] = useState(() => delayRender('Geist Mono'));
	useEffect(() => {
		const font = new FontFace('Geist Mono', `url(${staticFile('fonts/GeistMono.woff2')})`);
		font
			.load()
			.then((loaded) => document.fonts.add(loaded))
			.catch(() => {
				/* Fall back to the system monospace. */
			})
			.finally(() => continueRender(handle));
	}, [handle]);
};

export const Reel = () => {
	useFont();
	const frame = useCurrentFrame();
	// Every kick after the drop punches the picture in a little.
	const sinceKick = frame >= DROP ? (frame - DROP) % BEAT : Infinity;
	const punch = 1 + 0.035 * Math.exp(-sinceKick / 3);
	const flash = Math.max(
		0,
		...cuts.map(({at, strength}) =>
			frame >= at ? strength * Math.max(0, 1 - (frame - at) / 7) : 0,
		),
	);
	// Fade out over the last half beat so the loop wraps into the dark count-in.
	const out = interpolate(frame, [REEL_FRAMES - BEAT / 2, REEL_FRAMES - 1], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Audio src={TRACK} trimBefore={SONG_FRAME} />
			<AbsoluteFill style={{transform: `scale(${punch})`}}>
				{reelScenes.slice(0, 5).map(({id, from, to}) => {
					const Scene = scenes[id]!;
					return (
						<Sequence key={id} from={from} durationInFrames={to - from}>
							<Scene from={from} />
						</Sequence>
					);
				})}
				{montage.map((id, beat) => {
					const from = Math.round(MONTAGE + beat * BEAT);
					const to =
						beat === montage.length - 1 ? REEL_FRAMES : Math.round(MONTAGE + (beat + 1) * BEAT);
					const Scene = scenes[id]!;
					return (
						<Sequence key={`${id}-recap`} from={from} durationInFrames={to - from}>
							<Scene from={from} />
						</Sequence>
					);
				})}
			</AbsoluteFill>
			<AbsoluteFill
				style={{
					background: 'radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / 0.55))',
				}}
			/>
			<Hud />
			<AbsoluteFill style={{background: '#fff', opacity: flash, mixBlendMode: 'screen'}} />
			<AbsoluteFill style={{background: '#000', opacity: out}} />
		</AbsoluteFill>
	);
};
