import {useEffect, useMemo, useState, type ComponentType} from 'react';
import {Player} from '@remotion/player';
import {createPortal} from 'react-dom';
import {AbsoluteFill} from 'remotion';
import {
	Waveform,
	Spectre,
	Oscilloscope,
	Pulsar,
	Circle,
	Halo,
	AudioParticles,
} from '../../../../packages/elements/dist/components';

const DEFAULT_AUDIO = 'https://remotion.media/elements/remotion-made-this-picture-move.mp3';
const HALO_AUDIO =
	'https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/template-music-visualization/public/demo-track.mp3';
const AUDIO_PARTICLES_AUDIO =
	'https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/template-recorder/public/sounds/utope-rhythmic-reverie.mp3';
type Value = string | number | boolean;
type Props = Record<string, Value>;
type Control = {
	readonly key: string;
	readonly label: string;
	readonly type: 'range' | 'number' | 'color' | 'select' | 'boolean';
	readonly min?: number;
	readonly max?: number;
	readonly step?: number;
	readonly options?: readonly {
		readonly value: string;
		readonly label: string;
	}[];
};
const range = (key: string, label: string, min: number, max: number, step: number): Control => ({
	key,
	label,
	type: 'range',
	min,
	max,
	step,
});
const number = (key: string, label: string, min: number, max: number, step: number): Control => ({
	key,
	label,
	type: 'number',
	min,
	max,
	step,
});
const color = (key: string, label: string): Control => ({
	key,
	label,
	type: 'color',
});
const select = (
	key: string,
	label: string,
	options: readonly {readonly value: string; readonly label: string}[],
): Control => ({key, label, type: 'select', options});
const bool = (key: string, label: string): Control => ({
	key,
	label,
	type: 'boolean',
});
const colorMode = select('colorMode', 'Color mode', [
	{value: 'gradient', label: 'Gradient'},
	{value: 'rainbow', label: 'Rainbow'},
]);
const gain = range('inputGainDb', 'Visual gain', -30, 30, 1);
const intensity = range('intensity', 'Intensity', 0.1, 10, 0.1);

const HaloAndParticles = (props: Props) => {
	const audioSrc = String(props.audioSrc ?? AUDIO_PARTICLES_AUDIO);
	const audioOffsetInSeconds = Number(props.audioOffsetInSeconds ?? 0);
	return (
		<AbsoluteFill style={{backgroundColor: '#080a10'}}>
			<Halo
				audioSrc={audioSrc}
				audioOffsetInSeconds={audioOffsetInSeconds}
				playAudio={Boolean(props.playAudio ?? true)}
				intensity={6}
				inputGainDb={17}
				radius={0.18}
				trailDepth={9}
				glowBlur={45}
				glowSpread={30}
			/>
			<AudioParticles
				audioSrc={audioSrc}
				audioOffsetInSeconds={audioOffsetInSeconds}
				playAudio={false}
				width={720}
				height={720}
				maskHalo
				inputGainDb={22}
				intensity={7.4}
				radius={0.18}
				density={45}
				size={1.5}
			/>
		</AbsoluteFill>
	);
};
const examples = {
	waveform: {
		component: Waveform,
		width: 900,
		height: 300,
		props: {
			inputGainDb: 4,
			intensity: 1.6,
			color: '#b794ff',
			windowInSeconds: 2,
		},
		controls: [
			color('color', 'Color'),
			gain,
			intensity,
			range('windowInSeconds', 'Time window', 0.1, 5, 0.1),
		],
	},
	spectre: {
		component: Spectre,
		width: 1280,
		height: 300,
		props: {
			inputGainDb: 4,
			intensity: 4,
			startColor: '#3373d4',
			endColor: '#f567f5',
			colorMode: 'gradient',
			count: 64,
			barWidth: 3,
			bottom: false,
			spectreVariant: 'bars',
		},
		controls: [
			select('spectreVariant', 'Treatment', [
				{value: 'bars', label: 'Bars'},
				{value: 'segmented', label: 'Segmented'},
			]),
			colorMode,
			color('startColor', 'Start color'),
			color('endColor', 'End color'),
			gain,
			intensity,
			range('count', 'Bar count', 5, 150, 1),
			range('barWidth', 'Bar width', 0.5, 10, 0.5),
			bool('bottom', 'Align to bottom'),
		],
	},
	segmented: {
		component: Spectre,
		width: 1280,
		height: 300,
		props: {
			inputGainDb: 4,
			intensity: 4,
			startColor: '#3373d4',
			endColor: '#f567f5',
			colorMode: 'gradient',
			count: 64,
			barWidth: 3,
			bottom: false,
			spectreVariant: 'segmented',
		},
		controls: [],
	},
	oscilloscope: {
		component: Oscilloscope,
		width: 1280,
		height: 300,
		props: {
			inputGainDb: 4,
			amplitude: 1.5,
			lineColor: '#51e8cc',
			lineWidth: 3,
			sampleCount: 1024,
		},
		controls: [
			color('lineColor', 'Line color'),
			gain,
			range('amplitude', 'Amplitude', 0.1, 10, 0.1),
			range('lineWidth', 'Line width', 0.5, 10, 0.5),
			select('sampleCount', 'PCM samples', [
				{value: '256', label: '256'},
				{value: '512', label: '512'},
				{value: '1024', label: '1024'},
				{value: '2048', label: '2048'},
			]),
		],
	},
	pulsar: {
		component: Pulsar,
		width: 900,
		height: 500,
		props: {
			inputGainDb: 1,
			intensity: 1,
			density: 1.5,
			pattern: 4,
			volume: 2,
			startColor: '#592bb3',
			endColor: '#195753',
			colorMode: 'gradient',
		},
		controls: [
			colorMode,
			color('startColor', 'Start color'),
			color('endColor', 'End color'),
			gain,
			intensity,
			range('density', 'Density', 0.1, 5, 0.1),
			range('pattern', 'Pattern', 0.5, 16, 0.5),
			range('volume', 'Volume size', 0.5, 10, 0.5),
		],
	},
	circle: {
		component: Circle,
		width: 600,
		height: 600,
		props: {
			inputGainDb: 4,
			intensity: 4,
			radius: 0.46,
			count: 64,
			lineWidth: 3,
			startColor: '#b794ff',
			endColor: '#51e8cc',
			colorMode: 'gradient',
			circleVariant: 'radial-bars',
		},
		controls: [
			select('circleVariant', 'Treatment', [
				{value: 'radial-bars', label: 'Radial bars'},
				{value: 'glow-ring', label: 'Glow ring'},
				{value: 'waveform-ring', label: 'Waveform ring'},
				{value: 'dotted-ring', label: 'Dotted ring'},
			]),
			colorMode,
			color('startColor', 'Start color'),
			color('endColor', 'End color'),
			gain,
			intensity,
			range('radius', 'Radius', 0.05, 0.8, 0.01),
			range('count', 'Count', 5, 150, 1),
			range('lineWidth', 'Line / dot width', 0.5, 10, 0.5),
		],
	},
	glow: {
		component: Circle,
		width: 600,
		height: 600,
		props: {
			inputGainDb: 4,
			intensity: 4,
			radius: 0.46,
			circleVariant: 'glow-ring',
		},
		controls: [],
	},
	'ring-waveform': {
		component: Circle,
		width: 600,
		height: 600,
		props: {
			inputGainDb: 4,
			intensity: 4,
			radius: 0.46,
			circleVariant: 'waveform-ring',
		},
		controls: [],
	},
	dotted: {
		component: Circle,
		width: 600,
		height: 600,
		props: {
			inputGainDb: 4,
			intensity: 4,
			radius: 0.46,
			circleVariant: 'dotted-ring',
			count: 48,
			lineWidth: 1,
		},
		controls: [],
	},
	halo: {
		component: Halo,
		width: 720,
		height: 720,
		props: {
			inputGainDb: 17,
			intensity: 6,
			radius: 0.18,
			trailDepth: 9,
			waveDelay: true,
			glowBlur: 45,
			glowSpread: 30,
			startColor: '#b794ff',
			endColor: '#51e8cc',
			artworkSrc: '',
		},
		controls: [
			color('startColor', 'Start color'),
			color('endColor', 'End color'),
			gain,
			intensity,
			range('radius', 'Radius', 0.05, 0.8, 0.01),
			range('trailDepth', 'Trail layers', 1, 9, 1),
			bool('waveDelay', 'Delayed trails'),
			range('glowBlur', 'Glow blur', 0, 100, 1),
			range('glowSpread', 'Glow spread', 0, 100, 1),
		],
	},
	'audio-particles': {
		component: AudioParticles,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 22,
			intensity: 7.4,
			radius: 0.2,
			density: 45,
			size: 1.5,
			reactiveSpeed: true,
			maskHalo: false,
			color: '#b794ff',
		},
		controls: [
			color('color', 'Particle color'),
			gain,
			intensity,
			range('radius', 'Inner radius', 0.05, 0.8, 0.01),
			range('density', 'Density', 0, 50, 1),
			range('size', 'Particle size', 0.25, 2, 0.25),
			bool('reactiveSpeed', 'Bass-reactive speed'),
			bool('maskHalo', 'Mask Halo edge'),
		],
	},
	combined: {
		component: HaloAndParticles,
		width: 720,
		height: 720,
		props: {},
		controls: [],
	},
} as const;
export type PreviewKind = keyof typeof examples;
const defaultAudioFor = (kind: PreviewKind) => {
	if (kind === 'halo') return HALO_AUDIO;
	if (kind === 'audio-particles' || kind === 'combined') return AUDIO_PARTICLES_AUDIO;
	return DEFAULT_AUDIO;
};
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;
const PREVIEW_PADDING = 40;
type PreviewRendererProps = Props & {readonly previewKind: PreviewKind};

const PreviewRenderer = ({previewKind, ...props}: PreviewRendererProps) => {
	const example = examples[previewKind];
	const Component = example.component as ComponentType<Props>;
	const width = Math.max(16, Number(props.width ?? example.width));
	const height = Math.max(16, Number(props.height ?? example.height));
	const scale = Math.min(
		(PREVIEW_WIDTH - PREVIEW_PADDING * 2) / width,
		(PREVIEW_HEIGHT - PREVIEW_PADDING * 2) / height,
		1,
	);
	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#080a10',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<div
				style={{
					position: 'relative',
					flex: 'none',
					width,
					height,
					transform: `scale(${scale})`,
				}}
			>
				<Component {...props} width={width} height={height} />
			</div>
		</AbsoluteFill>
	);
};

const ControlField = ({
	control,
	value,
	update,
}: {
	control: Control;
	value: Value;
	update: (value: Value) => void;
}) => {
	if (control.type === 'boolean')
		return (
			<label className="toggle-control">
				<input
					type="checkbox"
					checked={Boolean(value)}
					onChange={(event) => update(event.target.checked)}
				/>
				<span>{control.label}</span>
			</label>
		);
	if (control.type === 'select')
		return (
			<label>
				<span>{control.label}</span>
				<select
					value={String(value)}
					onChange={(event) =>
						update(typeof value === 'number' ? Number(event.target.value) : event.target.value)
					}
				>
					{control.options?.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</label>
		);
	if (control.type === 'number')
		return (
			<label>
				<span>{control.label}</span>
				<input
					type="number"
					min={control.min}
					max={control.max}
					step={control.step}
					value={Number(value)}
					onChange={(event) => update(Number(event.target.value))}
				/>
			</label>
		);
	if (control.type === 'color')
		return (
			<label>
				<span>{control.label}</span>
				<span className="color-control">
					<input
						type="color"
						value={String(value)}
						onChange={(event) => update(event.target.value)}
					/>
					<output>{String(value)}</output>
				</span>
			</label>
		);
	return (
		<label>
			<span>
				{control.label}
				<output>
					{Number(value).toFixed((control.step ?? 1) <= 0.01 ? 2 : (control.step ?? 1) < 1 ? 1 : 0)}
				</output>
			</span>
			<input
				type="range"
				min={control.min}
				max={control.max}
				step={control.step}
				value={Number(value)}
				onChange={(event) => update(Number(event.target.value))}
			/>
		</label>
	);
};

export default function Preview({
	slug,
	variants = false,
	editable = false,
	controlsTargetId,
}: {
	slug: PreviewKind;
	variants?: boolean;
	editable?: boolean;
	controlsTargetId?: string;
}) {
	const [selected, setSelected] = useState<PreviewKind>(slug);
	const example = examples[selected];
	const initialProps = useMemo<Props>(
		() => ({...example.props, width: example.width, height: example.height}),
		[example],
	);
	const [customProps, setCustomProps] = useState<Props>(initialProps);
	const initialAudio = defaultAudioFor(slug);
	const [audioUrl, setAudioUrl] = useState(initialAudio);
	const [audioDraft, setAudioDraft] = useState(initialAudio);
	const [localAudio, setLocalAudio] = useState<{
		name: string;
		url: string;
	} | null>(null);
	useEffect(() => {
		setCustomProps(initialProps);
	}, [initialProps]);
	useEffect(() => {
		const defaultAudio = defaultAudioFor(selected);
		setAudioUrl(defaultAudio);
		setAudioDraft(defaultAudio);
	}, [selected]);
	useEffect(
		() => () => {
			if (localAudio) URL.revokeObjectURL(localAudio.url);
		},
		[localAudio],
	);
	const inputProps = useMemo(
		() => ({
			...customProps,
			audioSrc: localAudio?.url ?? audioUrl,
			audioOffsetInSeconds: Number(customProps.audioOffsetInSeconds ?? 0),
			playAudio: Boolean(customProps.playAudio ?? true),
		}),
		[audioUrl, customProps, localAudio],
	);
	const update = (key: string, value: Value) =>
		setCustomProps((current) => ({...current, [key]: value}));
	const reset = () => {
		if (localAudio) URL.revokeObjectURL(localAudio.url);
		setLocalAudio(null);
		const defaultAudio = defaultAudioFor(selected);
		setAudioUrl(defaultAudio);
		setAudioDraft(defaultAudio);
		setCustomProps(initialProps);
	};
	const controlsTarget =
		controlsTargetId && typeof document !== 'undefined'
			? document.getElementById(controlsTargetId)
			: null;
	return (
		<div className="preview-block not-content">
			{variants ? (
				<label className="variant-picker">
					Treatment{' '}
					<select
						value={selected}
						onChange={(event) => setSelected(event.target.value as PreviewKind)}
					>
						<optgroup label="Spectre">
							<option value="spectre">Frequency bars</option>
							<option value="segmented">Segmented</option>
						</optgroup>
						<optgroup label="Circle">
							<option value="circle">Radial bars</option>
							<option value="glow">Glow ring</option>
							<option value="ring-waveform">Waveform ring</option>
							<option value="dotted">Dotted ring</option>
						</optgroup>
						<optgroup label="Combined">
							<option value="combined">Halo + Audio Particles</option>
						</optgroup>
					</select>
				</label>
			) : null}
			<div className="preview-stage">
				<Player
					key={selected}
					component={PreviewRenderer}
					inputProps={{...inputProps, previewKind: selected}}
					compositionWidth={PREVIEW_WIDTH}
					compositionHeight={PREVIEW_HEIGHT}
					fps={60}
					durationInFrames={960}
					initialFrame={96}
					controls
					style={{width: '100%', aspectRatio: '16 / 9'}}
					errorFallback={({error}) => (
						<p role="alert">
							Preview unavailable: {error.message}. WebGL2 Elements need graphics acceleration; no
							alternate renderer is substituted.
						</p>
					)}
				/>
			</div>
			<div className="preview-caption">
				<span>60 FPS · 16 seconds · Press play to hear audio</span>
				<span>Curated preview settings — downloaded source defaults are unchanged</span>
			</div>
			{editable && controlsTarget
				? createPortal(
						<section className="preview-controls" aria-label={`${slug} preview controls`}>
							<div className="controls-heading">
								<div>
									<strong>Customize</strong>
									<span>Changes apply live to this preview.</span>
								</div>
								<button type="button" onClick={reset}>
									Reset
								</button>
							</div>
							<div className="audio-controls">
								<label className="wide-control">
									<span>Audio URL</span>
									<input
										type="url"
										value={audioDraft}
										disabled={Boolean(localAudio)}
										onChange={(event) => setAudioDraft(event.target.value)}
										placeholder="https://example.com/track.mp3"
									/>
								</label>
								<button
									type="button"
									disabled={Boolean(localAudio) || audioDraft === audioUrl}
									onClick={() => setAudioUrl(audioDraft)}
								>
									Use audio URL
								</button>
								<label className="file-control">
									<span>Or choose local audio</span>
									<input
										type="file"
										accept="audio/*"
										onChange={(event) => {
											const file = event.target.files?.[0];
											if (!file) return;
											if (localAudio) URL.revokeObjectURL(localAudio.url);
											setLocalAudio({
												name: file.name,
												url: URL.createObjectURL(file),
											});
										}}
									/>
								</label>
								{localAudio ? (
									<button
										type="button"
										onClick={() => {
											URL.revokeObjectURL(localAudio.url);
											setLocalAudio(null);
										}}
									>
										Use URL instead
									</button>
								) : null}
								<label>
									<span>
										Audio offset{' '}
										<output>{Number(customProps.audioOffsetInSeconds ?? 0).toFixed(1)}s</output>
									</span>
									<input
										type="range"
										min="0"
										max="60"
										step="0.1"
										value={Number(customProps.audioOffsetInSeconds ?? 0)}
										onChange={(event) => update('audioOffsetInSeconds', Number(event.target.value))}
									/>
								</label>
								<ControlField
									control={bool('playAudio', 'Play audio')}
									value={customProps.playAudio ?? true}
									update={(value) => update('playAudio', value)}
								/>
							</div>
							<div className="visual-controls">
								<ControlField
									control={number('width', 'Element width', 16, 3840, 1)}
									value={customProps.width}
									update={(value) => update('width', value)}
								/>
								<ControlField
									control={number('height', 'Element height', 16, 3840, 1)}
									value={customProps.height}
									update={(value) => update('height', value)}
								/>
								{example.controls.map((control) => (
									<ControlField
										key={control.key}
										control={control}
										value={
											customProps[control.key] ??
											(example.props[control.key as keyof typeof example.props] as Value)
										}
										update={(value) => update(control.key, value)}
									/>
								))}
							</div>
							{selected === 'halo' ? (
								<label className="wide-control artwork-control">
									<span>Optional artwork URL</span>
									<input
										type="url"
										value={String(customProps.artworkSrc ?? '')}
										onChange={(event) => update('artworkSrc', event.target.value)}
										placeholder="https://example.com/cover.jpg"
									/>
								</label>
							) : null}
							<p className="control-note">
								Remote media must allow CORS. Local files stay in your browser and are never
								uploaded.
							</p>
						</section>,
						controlsTarget,
					)
				: null}
		</div>
	);
}
