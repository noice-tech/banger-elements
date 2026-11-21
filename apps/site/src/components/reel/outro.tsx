import {AbsoluteFill, Easing} from 'remotion';
import {AudioParticles, Pulsar, Space} from '../../../../../packages/elements/dist/components';
import {Shake, Shockwaves, Streak, kick, kicksBetween, pulse, ramp, useReelFrame} from './fx';
import {Logo} from './logo';
import {fill, layer, type Part} from './parts';
import {BAR, BEAT} from './scenes';

/**
 * The riser lands on a fresh kick and the lights come back on a Pulsar. The mark hits, slides home, the name
 * stamps in on the next kicks, and the whole lockup ignites on the downbeat of bar two.
 */
export const Outro: Part = ({from, length}) => {
	const frame = useReelFrame(from);
	const o = frame - from;
	const k = kick(frame, 4);
	const hit = pulse(o, 0, 8);
	const stop = pulse(o, BEAT * 3, 6);
	const ignite = pulse(o, BAR, 6);
	const settle = ramp(o, 0, BEAT * 2, Easing.out(Easing.cubic));
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Shake frame={frame} amount={26 * hit + 10 * stop + 16 * ignite + 2.5 * k}>
				<AbsoluteFill style={{transform: `scale(${1.12 - 0.08 * settle + 0.04 * (o / length)})`}}>
					<Space
						{...layer(from)}
						baseColor="#7a5cff"
						speed={1.4}
						stellarDensity={22}
						zoom={1.1}
						responsive={2}
						style={{...fill, opacity: 0.8, filter: 'saturate(1.6)'}}
					/>
				</AbsoluteFill>
				<AbsoluteFill
					style={{
						transform: `scale(${1 + 0.7 * hit + 0.4 * stop + 0.5 * ignite + 0.05 * k})`,
						mixBlendMode: 'screen',
						opacity: 0.55 + 0.4 * Math.max(hit, stop, ignite),
					}}
				>
					<Pulsar {...layer(from)} colorMode="rainbow" intensity={1} />
				</AbsoluteFill>
				<AbsoluteFill
					style={{
						background: `repeating-conic-gradient(from ${o * 0.6}deg at 50% 50%, rgb(190 170 255 / 0.55) 0deg 3deg, transparent 3deg 12deg)`,
						maskImage: 'radial-gradient(circle at 50% 50%, #000 0%, transparent 70%)',
						mixBlendMode: 'screen',
						opacity: 0.12 + 0.25 * k + 0.4 * Math.max(hit, ignite),
					}}
				/>
				<AudioParticles
					{...layer(from)}
					color="#efe8ff"
					density={30}
					intensity={6}
					radius={0.3}
					size={1.1}
				/>
				<Shockwaves
					frame={frame}
					births={kicksBetween(from, from + length)}
					color="#c9b8ff"
					from={120}
					to={900}
					life={22}
					width={4}
					strength={0.8}
				/>
				<Shockwaves
					frame={frame}
					births={[from, from + BEAT * 3, from + BAR]}
					color="#ffffff"
					from={60}
					to={1200}
					life={26}
					width={7}
				/>
				<Logo o={o} k={k} />
				<Streak amount={Math.max(hit, stop, ignite, 0.5 * k)} color="#cdb4ff" thickness={6} />
			</Shake>
			<AbsoluteFill style={{background: '#fff', opacity: 0.55 * pulse(o, 0, 3) + 0.35 * ignite}} />
			<AbsoluteFill
				style={{
					background: 'radial-gradient(ellipse at center, transparent 50%, rgb(0 0 0 / 0.6))',
				}}
			/>
		</AbsoluteFill>
	);
};
