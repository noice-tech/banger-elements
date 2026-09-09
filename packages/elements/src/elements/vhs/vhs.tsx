import React, {forwardRef, useId, useImperativeHandle, useRef} from 'react';
import {
	Interactive,
	Sequence,
	useCurrentFrame,
	useVideoConfig,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type InteractivitySchema,
	type SequenceControls,
} from 'remotion';

// Browser-composited adaptation of banger.show's VHS effect.
// SVG displacement is not a pixel-identical implementation of its GLSL pass.
// This wrapper filters only its children, never sibling layers behind it.
type VhsOptions = {
	readonly children?: React.ReactNode;
	readonly width?: number;
	readonly height?: number;
	readonly strength?: number;
	readonly horizontalDistortion?: number;
	readonly glitch?: number;
	readonly line?: number;
	readonly period?: number;
	readonly timeOffsetInSeconds?: number;
};
type VhsProps = InteractiveBaseProps & InteractiveTransformProps & VhsOptions;

const vhsSchema = {
	...Interactive.baseSchema,
	width: {
		type: 'number',
		default: 1280,
		min: 16,
		max: 3840,
		step: 1,
		keyframable: false,
		hiddenFromList: false,
	},
	height: {
		type: 'number',
		default: 720,
		min: 16,
		max: 3840,
		step: 1,
		keyframable: false,
		hiddenFromList: false,
	},
	strength: {
		type: 'number',
		default: 1,
		min: 0,
		max: 1,
		step: 0.01,
		description: 'Effect strength; zero bypasses all treatment',
		hiddenFromList: false,
	},
	horizontalDistortion: {
		type: 'number',
		default: 0.02,
		min: 0.005,
		max: 0.07,
		step: 0.001,
		description: 'Horizontal distortion',
		hiddenFromList: false,
	},
	glitch: {
		type: 'number',
		default: 0.07,
		min: 0.01,
		max: 0.07,
		step: 0.01,
		description: 'Fine tape jitter',
		hiddenFromList: false,
	},
	line: {
		type: 'number',
		default: 0.28,
		min: 0.01,
		max: 1,
		step: 0.01,
		description: 'Tracking band strength',
		hiddenFromList: false,
	},
	period: {
		type: 'number',
		default: 1.2,
		min: 0.01,
		max: 2,
		step: 0.01,
		description: 'Tracking band speed; changes animation phase',
		hiddenFromList: false,
	},
	timeOffsetInSeconds: {
		type: 'number',
		default: 0,
		min: -86400,
		max: 86400,
		step: 0.01,
		description: 'Effect phase, independent of child media trim',
		hiddenFromList: false,
	},
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

function bounded(value: number, min: number, max: number, fallback: number) {
	return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

// Source-time seeds make direct seeks and parallel rendering independent of
// previously rendered frames. Fixed 60 Hz grain also matches across FPS values.
function vhsTiming(time: number, period: number) {
	const tick = Math.floor(time * 60 + 1e-7);
	return {
		grainSeed: ((tick % 65521) + 65521) % 65521,
		warpSeed: ((Math.floor(time * 10 + 1e-7) % 65521) + 65521) % 65521,
		tracking: (((time * period * 0.25) % 1) + 1) % 1,
	};
}

function VhsContent({
	children,
	width,
	height,
	strength,
	horizontalDistortion,
	glitch,
	line,
	period,
	timeOffsetInSeconds,
}: Required<Omit<VhsOptions, 'children'>> & {readonly children?: React.ReactNode}) {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const filterId = `vhs-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
	const amount = bounded(strength, 0, 1, 1);
	const timing = vhsTiming(
		frame / fps + bounded(timeOffsetInSeconds, -86400, 86400, 0),
		bounded(period, 0.01, 2, 1.2),
	);
	return (
		<>
			<svg width={0} height={0} aria-hidden style={{position: 'absolute', pointerEvents: 'none'}}>
				<defs>
					<filter
						id={filterId}
						x="-20%"
						y="-20%"
						width="140%"
						height="140%"
						colorInterpolationFilters="sRGB"
					>
						<feTurbulence
							type="fractalNoise"
							baseFrequency={`0 ${5 / height}`}
							numOctaves={2}
							seed={timing.warpSeed}
							result="broadNoise"
						/>
						{/* Neutral green channel prevents vertical displacement. */}
						<feColorMatrix
							in="broadNoise"
							type="matrix"
							values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1"
							result="broadMap"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="broadMap"
							scale={width * bounded(horizontalDistortion, 0.005, 0.07, 0.02) * amount}
							xChannelSelector="R"
							yChannelSelector="G"
							result="warped"
						/>
						<feTurbulence
							type="fractalNoise"
							baseFrequency={`0 ${150 / height}`}
							numOctaves={1}
							seed={timing.grainSeed}
							result="fineNoise"
						/>
						<feColorMatrix
							in="fineNoise"
							type="matrix"
							values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1"
							result="fineMap"
						/>
						<feDisplacementMap
							in="warped"
							in2="fineMap"
							scale={width * bounded(glitch, 0.01, 0.07, 0.07) * amount * 0.3}
							xChannelSelector="R"
							yChannelSelector="G"
							result="distorted"
						/>
						<feTurbulence
							type="fractalNoise"
							baseFrequency={0.7}
							numOctaves={1}
							seed={timing.grainSeed}
							result="grain"
						/>
						<feColorMatrix in="grain" type="saturate" values="0" result="grayGrain" />
						<feComponentTransfer in="grayGrain" result="faintGrain">
							<feFuncA type="linear" slope={0.15 * amount} />
						</feComponentTransfer>
						<feComposite in="faintGrain" in2="distorted" operator="in" result="maskedGrain" />
						<feBlend in="distorted" in2="maskedGrain" mode="soft-light" />
					</filter>
				</defs>
			</svg>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					filter: amount === 0 ? undefined : `url(#${filterId})`,
				}}
			>
				{children}
			</div>
			{amount > 0 ? (
				<div
					aria-hidden
					style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: amount}}
				>
					<div
						style={{
							position: 'absolute',
							left: 0,
							right: 0,
							top: `${timing.tracking * 100}%`,
							height: Math.max(2, height * 0.018),
							background: '#000',
							opacity: bounded(line, 0.01, 1, 0.28) * 0.35,
						}}
					/>
					<div
						style={{
							position: 'absolute',
							left: 0,
							right: 0,
							bottom: 0,
							height: height * 0.025,
							background:
								'repeating-linear-gradient(0deg, #ffffff18 0px, #ffffff18 1px, transparent 1px, transparent 3px)',
						}}
					/>
				</div>
			) : null}
		</>
	);
}

const VhsInner = forwardRef<
	HTMLDivElement,
	VhsProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			children,
			width = vhsSchema.width.default,
			height = vhsSchema.height.default,
			strength = vhsSchema.strength.default,
			horizontalDistortion = vhsSchema.horizontalDistortion.default,
			glitch = vhsSchema.glitch.default,
			line = vhsSchema.line.default,
			period = vhsSchema.period.default,
			timeOffsetInSeconds = vhsSchema.timeOffsetInSeconds.default,
			controls,
			name,
			style,
			...sequenceProps
		},
		ref,
	) => {
		const outlineRef = useRef<HTMLDivElement>(null);
		useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);
		const drawingWidth = Math.round(bounded(width, 16, 3840, 1280));
		const drawingHeight = Math.round(bounded(height, 16, 3840, 720));
		return (
			<Sequence
				layout="none"
				{...sequenceProps}
				controls={controls}
				name={name ?? 'VHS'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{
						position: 'relative',
						boxSizing: 'border-box',
						width: drawingWidth,
						height: drawingHeight,
						overflow: 'hidden',
						isolation: 'isolate',
						...style,
					}}
				>
					<VhsContent
						width={drawingWidth}
						height={drawingHeight}
						strength={strength}
						horizontalDistortion={horizontalDistortion}
						glitch={glitch}
						line={line}
						period={period}
						timeOffsetInSeconds={timeOffsetInSeconds}
					>
						{children}
					</VhsContent>
				</div>
			</Sequence>
		);
	},
);

export const Vhs = Interactive.withSchema({
	Component: VhsInner,
	componentName: '<Vhs>',
	componentIdentity: null,
	schema: vhsSchema,
	supportsEffects: false,
}) as React.FC<VhsProps>;
