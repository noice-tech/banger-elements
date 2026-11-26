import {useEffect, useState, type CSSProperties} from 'react';
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
import {Aberration, kick} from './fx';
import {Outro} from './outro';
import {DEMO_SONG} from '../recipes/recipes';
import {Recap, parts} from './parts';
import {BAR, BEAT, DROP, OUTRO, REEL_FRAMES, SONG_FRAME, TICK, reelScenes} from './scenes';

const MONTAGE = reelScenes[5]!.from;
const recapOrder = ['drop', 'ride', 'tape', 'metal'] as const;

const cuts = [
	...reelScenes
		.slice(1, 5)
		.map((scene) => ({at: scene.from, strength: scene.from === DROP ? 0.95 : 0.5})),
	...recapOrder.map((_, index) => ({at: Math.round(MONTAGE + (index * BEAT) / 2), strength: 0.3})),
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

const captionFor = (scene: (typeof reelScenes)[number], eighth: number) => {
	if (scene.id !== 'recap') return scene.layers.join(' × ');
	if (eighth >= 4) return 'Every element at once';
	return reelScenes.find((candidate) => candidate.id === recapOrder[eighth])!.layers.join(' × ');
};

const Hud = () => {
	const frame = useCurrentFrame();
	if (frame >= OUTRO) return null;
	const scene = [...reelScenes].reverse().find((candidate) => candidate.from <= frame)!;
	const bar = Math.floor((frame - DROP) / BAR) + 1;
	const eighth = Math.floor((frame - MONTAGE) / (BEAT / 2));
	const caption = captionFor(scene, eighth);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{...label, left: 44, top: 38}}>Banger Elements</div>
			<div style={{...label, right: 44, top: 38, opacity: 0.75}}>
				{frame < DROP ? 'Count-in' : `Bar ${String(bar).padStart(2, '0')} / 08`}
			</div>
			<div style={{...label, left: 44, bottom: 38}}>{caption}</div>
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
			.catch(() => {})
			.finally(() => continueRender(handle));
	}, [handle]);
};

export const Reel = () => {
	useFont();
	const frame = useCurrentFrame();
	const hit = kick(frame);
	const fringe = frame >= OUTRO ? 0 : 1 + 6 * hit;
	const punch = 1 + 0.04 * hit;
	const flash = Math.max(
		0,
		...cuts.map(({at, strength}) =>
			frame >= at ? strength * Math.max(0, 1 - (frame - at) / (7 * TICK)) : 0,
		),
	);
	const out = interpolate(frame, [REEL_FRAMES - 18 * TICK, REEL_FRAMES - 2 * TICK], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Audio
				src={staticFile(DEMO_SONG)}
				trimBefore={SONG_FRAME}
				volume={(audioFrame) =>
					interpolate(audioFrame, [REEL_FRAMES - 20 * TICK, REEL_FRAMES - 2 * TICK], [1, 0], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					})
				}
			/>
			<AbsoluteFill style={{transform: `scale(${punch})`}}>
				<Aberration amount={fringe} brightness={1 + 0.1 * hit}>
					{reelScenes.slice(0, 5).map(({id, from, to}) => {
						const Scene = parts[id]!;
						return (
							<Sequence key={id} from={from} durationInFrames={to - from}>
								<Scene from={from} length={to - from} />
							</Sequence>
						);
					})}
					<Sequence from={MONTAGE} durationInFrames={OUTRO - MONTAGE}>
						<Recap from={MONTAGE} length={OUTRO - MONTAGE} />
					</Sequence>
					<Sequence from={OUTRO} durationInFrames={REEL_FRAMES - OUTRO}>
						<Outro from={OUTRO} length={REEL_FRAMES - OUTRO} />
					</Sequence>
				</Aberration>
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
