// A looping scene for a livestream or a "beats to study to" upload: 1280 × 720 at 30 fps.
// The city sits behind wet glass; the title and now-playing card stay crisp in front.
import {AbsoluteFill, staticFile} from 'remotion';
import {City, Waveform, WetGlass} from '../../../../../packages/elements/dist/components';

const START = 34.16; // seconds into the track
const W = 1280;
const H = 720;

export const RainyStream = ({audioSrc = staticFile('track.mp3')}: {audioSrc?: string}) => {
	const audio = {audioSrc, audioOffsetInSeconds: START, playAudio: false};

	return (
		<AbsoluteFill style={{color: '#fff', fontFamily: 'Geist, Inter, system-ui, sans-serif'}}>
			<WetGlass width={W} height={H} amount={0.7} blur={0.3} refraction={1} seed={7}>
				<City
					{...audio}
					playAudio
					width={W}
					height={H}
					lightsColor="#ffbb88"
					startColor="#3d4a66"
					style={{position: 'absolute', inset: 0}}
				/>
			</WetGlass>

			<div
				style={{position: 'absolute', left: 64, top: 56, textShadow: '0 2px 20px rgb(0 0 0 / 0.5)'}}
			>
				<div style={{fontSize: 16, letterSpacing: 6, opacity: 0.8}}>LIVE · 02:14 AM</div>
				<div
					style={{marginTop: 12, fontSize: 64, fontWeight: 800, lineHeight: 1, letterSpacing: -2}}
				>
					beats to
					<br />
					render to
				</div>
			</div>

			<div
				style={{
					position: 'absolute',
					left: 64,
					bottom: 56,
					display: 'flex',
					alignItems: 'center',
					gap: 22,
					padding: '16px 22px',
					borderRadius: 18,
					background: 'rgb(12 14 22 / 0.62)',
					border: '1px solid rgb(255 255 255 / 0.12)',
				}}
			>
				<div
					style={{
						width: 56,
						height: 56,
						borderRadius: 10,
						background: 'linear-gradient(140deg, #ffbb88, #5b4b8a)',
					}}
				/>
				<div>
					<div style={{fontSize: 13, letterSpacing: 3, opacity: 0.65}}>NOW PLAYING</div>
					<div style={{marginTop: 4, fontSize: 21, fontWeight: 600}}>Mara Quinn — Low Light</div>
				</div>
				<Waveform {...audio} width={220} height={52} color="#ffd9bd" windowInSeconds={1.5} />
			</div>
		</AbsoluteFill>
	);
};
