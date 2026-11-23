import {AbsoluteFill, Easing} from 'remotion';
import {AudioParticles, Pulsar, Space} from '../../../../../packages/elements/dist/components';
import {Shake, kick, pulse, ramp, useReelFrame} from './fx';
import {Logo} from './logo';
import {fill, layer, type Part} from './parts';
import {BAR, BEAT, TICK} from './scenes';

/**
 * The riser lands on a fresh kick and the lights come back on a Pulsar. The mark hits, slides home, the name
 * stamps in on the next kicks, and the whole lockup ignites on the downbeat of bar two.
 */
export const Outro: Part = ({from, length}) => {
	const frame = useReelFrame(from);
	const o = frame - from;
	const k = kick(frame, 4 * TICK);
	const hit = pulse(o, 0, 8 * TICK);
	const stop = pulse(o, BEAT * 3, 6 * TICK);
	const ignite = pulse(o, BAR, 6 * TICK);
	const settle = ramp(o, 0, BEAT * 2, Easing.out(Easing.cubic));
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Shake frame={frame} amount={10 * hit + 4 * stop + 6 * ignite + 1.5 * k}>
				<AbsoluteFill style={{transform: `scale(${1.12 - 0.08 * settle + 0.04 * (o / length)})`}}>
					<Space
						{...layer(from)}
						baseColor="#7a5cff"
						speed={1.4}
						stellarDensity={22}
						zoom={1.1}
						responsive={2}
						style={{...fill, opacity: 0.7}}
					/>
				</AbsoluteFill>
				<AbsoluteFill
					style={{
						transform: `scale(${1 + 0.35 * hit + 0.2 * stop + 0.25 * ignite + 0.04 * k})`,
						mixBlendMode: 'screen',
						opacity: 0.4 + 0.3 * Math.max(hit, stop, ignite),
					}}
				>
					<Pulsar {...layer(from)} startColor="#6a32ff" endColor="#170b52" intensity={0.6} />
				</AbsoluteFill>
				<AudioParticles
					{...layer(from)}
					color="#efe8ff"
					density={30}
					intensity={6}
					radius={0.3}
					size={1.1}
				/>
				<Logo o={o} k={k} />
			</Shake>
			<AbsoluteFill style={{background: '#fff', opacity: 0.55 * pulse(o, 0)}} />
		</AbsoluteFill>
	);
};
