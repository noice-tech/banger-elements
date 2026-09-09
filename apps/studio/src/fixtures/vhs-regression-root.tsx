// Isolated regression root; not registered in the normal Studio workspace.
// Run scripts/vhs-regression.mjs after building the Elements.
import React from 'react';
import {AbsoluteFill, Composition, registerRoot, staticFile} from 'remotion';
import {Space} from '../../../../packages/elements/dist/elements/space';
import {Waveform} from '../../../../packages/elements/dist/elements/waveform';
import {Vhs} from '../../../../packages/elements/dist/elements/vhs';

const Content = ({webgl = false}: {readonly webgl?: boolean}) => (
	<>
		{webgl ? (
			<Space width={640} height={360} audioSrc={staticFile('silence.wav')} playAudio={false} />
		) : null}
		<svg width={640} height={360} style={{position: 'absolute', inset: 0}}>
			{Array.from({length: 16}, (_, i) => (
				<rect
					key={i}
					x={i * 40}
					y={30}
					width={20}
					height={300}
					fill={i % 2 ? '#ffbd66' : '#57d6ee'}
					opacity={0.7}
				/>
			))}
			<circle cx={320} cy={180} r={95} fill="#dd397b" />
		</svg>
		<Waveform width={640} height={360} audioSrc={staticFile('silence.wav')} playAudio={false} />
		<div
			style={{
				position: 'absolute',
				left: 50,
				top: 110,
				fontFamily: 'sans-serif',
				fontWeight: 900,
				fontSize: 56,
				color: 'white',
			}}
		>
			BANGER
			<br />
			VHS TEST
		</div>
	</>
);

const Comparison = ({webgl = false}: {readonly webgl?: boolean}) => (
	<AbsoluteFill style={{background: '#141c30', justifyContent: 'center'}}>
		<div style={{display: 'flex'}}>
			<Vhs width={640} height={360} strength={0}>
				<Content webgl={webgl} />
			</Vhs>
			<Vhs width={640} height={360} horizontalDistortion={0.07}>
				<Content webgl={webgl} />
			</Vhs>
		</div>
		<div
			style={{
				position: 'absolute',
				top: 18,
				left: 24,
				fontFamily: 'sans-serif',
				color: 'white',
				fontSize: 24,
			}}
		>
			Original / VHS — {webgl ? 'WebGL + SVG + HTML' : 'SVG + HTML + transparency'}
		</div>
	</AbsoluteFill>
);

const Isolation = () => (
	<AbsoluteFill style={{background: '#243b4a', justifyContent: 'center'}}>
		<div style={{display: 'flex'}}>
			<Vhs width={640} height={360} horizontalDistortion={0.07}>
				<Content />
			</Vhs>
			<Vhs width={640} height={360} horizontalDistortion={0.005} timeOffsetInSeconds={7}>
				<Content />
			</Vhs>
		</div>
	</AbsoluteFill>
);

const Single = ({
	mode = 'effect',
	from = 0,
}: {
	readonly mode?: 'plain' | 'bypass' | 'effect';
	readonly from?: number;
}) =>
	mode === 'plain' ? (
		<div style={{position: 'relative', width: 640, height: 360}}>
			<Content />
		</div>
	) : (
		<Vhs width={640} height={360} from={from} strength={mode === 'bypass' ? 0 : 1}>
			<Content />
		</Vhs>
	);

registerRoot(() => (
	<>
		<Composition
			id="VhsSingle"
			component={Single}
			durationInFrames={120}
			fps={30}
			width={640}
			height={360}
		/>
		<Composition
			id="VhsPlain"
			component={Single}
			defaultProps={{mode: 'plain' as const}}
			durationInFrames={120}
			fps={30}
			width={640}
			height={360}
		/>
		<Composition
			id="VhsBypass"
			component={Single}
			defaultProps={{mode: 'bypass' as const}}
			durationInFrames={120}
			fps={30}
			width={640}
			height={360}
		/>
		<Composition
			id="VhsDelayed"
			component={Single}
			defaultProps={{from: 15}}
			durationInFrames={120}
			fps={30}
			width={640}
			height={360}
		/>
		<Composition
			id="VhsSvg"
			component={Comparison}
			durationInFrames={120}
			fps={30}
			width={1280}
			height={480}
		/>
		<Composition
			id="VhsWebgl"
			component={Comparison}
			defaultProps={{webgl: true}}
			durationInFrames={120}
			fps={30}
			width={1280}
			height={480}
		/>
		<Composition
			id="VhsIsolation"
			component={Isolation}
			durationInFrames={120}
			fps={30}
			width={1280}
			height={480}
		/>
		<Composition
			id="VhsSvg60"
			component={Comparison}
			durationInFrames={240}
			fps={60}
			width={1280}
			height={480}
		/>
	</>
));
