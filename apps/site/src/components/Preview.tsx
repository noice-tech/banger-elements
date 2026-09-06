import {useEffect, useMemo, useState, type ComponentType} from 'react';
import {Player} from '@remotion/player';
import {createPortal} from 'react-dom';
import {AbsoluteFill} from 'remotion';
import ExamplePicker from './ExamplePicker';
import {configuredJsx, isAdvancedControl} from './preview-config';
import {
	Waveform,
	Spectre,
	Oscilloscope,
	Pulsar,
	Circle,
	Halo,
	AudioParticles,
	Ferrofluid,
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
	ferrofluid: {
		component: Ferrofluid,
		width: 720,
		height: 720,
		props: {
			inputGainDb: 10,
			intensity: 2,
			pattern: 2,
			fluidity: 0.15,
			color: '#161923',
			shineColor: '#ffbc8e',
			shineX: -0.3,
			shineY: -1,
			shineZ: -0.5,
			shineIntensity: 2.6,
			shineSize: 1,
			roughness: 0.15,
			iridescence: 0.3,
			envMapIntensity: 1,
			audioLights: true,
			quality: 'medium',
			mappingMode: 'uniform',
			autoRotate: true,
			rotationSpeed: 1,
		},
		controls: [
			color('color', 'Metal tint'),
			color('shineColor', 'Shine color'),
			range('shineX', 'Shine X', -3, 3, 0.1),
			range('shineY', 'Shine Y', -3, 3, 0.1),
			range('shineZ', 'Shine Z', -3, 3, 0.1),
			range('shineIntensity', 'Shine intensity', 0, 10, 0.1),
			range('shineSize', 'Shine size', 0.1, 3, 0.1),
			gain,
			range('intensity', 'Intensity', 0.1, 12, 0.1),
			range('pattern', 'Spike density', 1, 20, 0.1),
			range('fluidity', 'Fluidity', 0, 1, 0.01),
			range('roughness', 'Roughness', 0, 1, 0.01),
			range('iridescence', 'Iridescence', 0, 1, 0.01),
			range('envMapIntensity', 'Studio reflections', 0, 2, 0.01),
			select('quality', 'Quality', [
				{value: 'low', label: 'Low'},
				{value: 'medium', label: 'Medium'},
				{value: 'high', label: 'High'},
			]),
			select('mappingMode', 'Frequency mapping', [
				{value: 'uniform', label: 'Uniform'},
				{value: 'latitude', label: 'Latitude'},
				{value: 'radial', label: 'Radial'},
				{value: 'voronoi', label: 'Voronoi'},
			]),
			bool('audioLights', 'Audio-reactive lights'),
			bool('autoRotate', 'Auto rotate'),
			range('rotationSpeed', 'Rotation speed', -3, 3, 0.1),
		],
	},
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
	if (kind === 'halo' || kind === 'ferrofluid') return HALO_AUDIO;
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
				aria-label={control.label}
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
	const [panel, setPanel] = useState<'look' | 'audio' | 'more'>('look');
	const [copyMessage, setCopyMessage] = useState('');
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
	const update = (key: string, value: Value) => {
		setCustomProps((current) => ({...current, [key]: value}));
		setCopyMessage('');
	};
	const reset = () => {
		setCopyMessage('');
		if (localAudio) URL.revokeObjectURL(localAudio.url);
		setLocalAudio(null);
		const defaultAudio = defaultAudioFor(selected);
		setAudioUrl(defaultAudio);
		setAudioDraft(defaultAudio);
		setCustomProps(initialProps);
	};
	const presets =
		selected === 'ferrofluid'
			? [
					{label: 'Studio metal', props: examples.ferrofluid.props},
					{
						label: 'Polished chrome',
						props: {
							...examples.ferrofluid.props,
							color: '#aab1c0',
							shineColor: '#d4e5ff',
							roughness: 0.05,
							iridescence: 0,
							intensity: 1.4,
						},
					},
					{
						label: 'Ultraviolet',
						props: {
							...examples.ferrofluid.props,
							color: '#27123e',
							shineColor: '#d5a2ff',
							roughness: 0.22,
							iridescence: 0.8,
							intensity: 2.8,
						},
					},
				]
			: [];
	const activePreset = presets.findIndex((preset) =>
		Object.entries(preset.props).every(([key, value]) => customProps[key] === value),
	);
	const copyConfiguration = async () => {
		try {
			await navigator.clipboard.writeText(configuredJsx(slug, inputProps, Boolean(localAudio)));
			setCopyMessage(
				localAudio
					? 'Copied. Replace the audio path with your project asset.'
					: 'Configuration copied. Paste inside your composition.',
			);
		} catch {
			setCopyMessage('Clipboard unavailable. Select and copy the configuration below.');
		}
	};
	const controlsTarget =
		controlsTargetId && typeof document !== 'undefined'
			? document.getElementById(controlsTargetId)
			: null;
	return (
		<div className="preview-block not-content">
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
			{variants ? <ExamplePicker selected={selected} onSelect={setSelected} /> : null}
			{editable && controlsTarget
				? createPortal(
						<section className="preview-controls" aria-label={`${slug} preview controls`}>
							<div className="controls-heading">
								<div>
									<strong>Preview settings</strong>
									<span>Changes apply live.</span>
								</div>
								<button type="button" onClick={reset}>
									Reset
								</button>
							</div>
							<div className="inspector-tabs" role="tablist" aria-label="Preview settings">
								{(['look', 'audio', 'more'] as const).map((tab, index, tabs) => (
									<button
										key={tab}
										type="button"
										role="tab"
										id={`${slug}-tab-${tab}`}
										aria-selected={panel === tab}
										aria-controls={`${slug}-panel-${tab}`}
										tabIndex={panel === tab ? 0 : -1}
										onClick={() => setPanel(tab)}
										onKeyDown={(event) => {
											const next =
												event.key === 'ArrowRight'
													? (index + 1) % tabs.length
													: event.key === 'ArrowLeft'
														? (index + tabs.length - 1) % tabs.length
														: event.key === 'Home'
															? 0
															: event.key === 'End'
																? tabs.length - 1
																: -1;
											if (next < 0) return;
											event.preventDefault();
											setPanel(tabs[next]!);
											document.getElementById(`${slug}-tab-${tabs[next]}`)?.focus();
										}}
									>
										{tab === 'look' ? 'Look' : tab === 'audio' ? 'Audio' : 'More'}
									</button>
								))}
							</div>
							<div
								role="tabpanel"
								id={`${slug}-panel-audio`}
								aria-labelledby={`${slug}-tab-audio`}
								hidden={panel !== 'audio'}
								tabIndex={0}
							>
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
											aria-label="Audio offset"
											min="0"
											max="60"
											step="0.1"
											value={Number(customProps.audioOffsetInSeconds ?? 0)}
											onChange={(event) =>
												update('audioOffsetInSeconds', Number(event.target.value))
											}
										/>
									</label>
									<ControlField
										control={bool('playAudio', 'Play audio')}
										value={customProps.playAudio ?? true}
										update={(value) => update('playAudio', value)}
									/>
								</div>
								<p className="control-note">
									Remote media must allow CORS. Local files stay in your browser and are never
									uploaded.
								</p>
							</div>
							<div
								role="tabpanel"
								id={`${slug}-panel-more`}
								aria-labelledby={`${slug}-tab-more`}
								hidden={panel !== 'more'}
								tabIndex={0}
							>
								<p className="inspector-section-label">CANVAS & ADVANCED</p>
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
									{example.controls
										.filter((control) => isAdvancedControl(control.key))
										.map((control) => (
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
							</div>
							<div
								role="tabpanel"
								id={`${slug}-panel-look`}
								aria-labelledby={`${slug}-tab-look`}
								hidden={panel !== 'look'}
								tabIndex={0}
							>
								{presets.length > 0 ? (
									<label className="preset-picker">
										<span>Starting point</span>
										<select
											aria-label="Preview preset"
											value={activePreset}
											onChange={(event) => {
												const preset = presets[Number(event.target.value)];
												if (preset) setCustomProps((current) => ({...current, ...preset.props}));
											}}
										>
											<option value={-1} disabled>
												Custom look
											</option>
											{presets.map((preset, index) => (
												<option key={preset.label} value={index}>
													{preset.label}
												</option>
											))}
										</select>
									</label>
								) : null}
								<p className="inspector-section-label">SHAPE & APPEARANCE</p>
								<div className="visual-controls">
									{example.controls
										.filter((control) => !isAdvancedControl(control.key))
										.map((control) => (
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
							</div>
							<details className="configuration-export">
								<summary>Use these settings in code</summary>
								<p className="control-note">
									Preview settings are separate from the installed source defaults.
								</p>
								<button type="button" className="button" onClick={copyConfiguration}>
									Copy configured JSX
								</button>
								<p className="control-note" role="status">
									{copyMessage}
								</p>
								<pre tabIndex={0} aria-label="Configured JSX">
									<code>{configuredJsx(slug, inputProps, Boolean(localAudio))}</code>
								</pre>
							</details>
						</section>,
						controlsTarget,
					)
				: null}
		</div>
	);
}
