/* eslint-disable @remotion/warn-native-media-tag -- Landing-page UI around the Player, not part of a rendered composition. */
import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ComponentProps,
} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {Html5Audio} from 'remotion';
import {examples, type PreviewKind} from './preview/examples';
import {PreviewRenderer, PREVIEW_WIDTH, PREVIEW_HEIGHT} from './preview/PreviewRenderer';
import {ControlField} from './preview/ControlField';
import {usePlayerReady} from './preview/player';
import type {Control} from './preview/controls';
import type {PreviewProps, PreviewValue} from './preview/types';
import {highlightLine} from './highlight';
import tunerWave from './tuner-wave.json';
import {
	PlayButton,
	Segments,
	SoundButton,
	StageError,
	isContextLoss,
	Swatches,
	TrackWave,
	toggleSound,
	usePlayerRecovery,
	usePlayerStatus,
	useVisiblePlayback,
} from './stage/parts';

type Pick = {slug: PreviewKind; title: string; name: string};

const FPS = 60;

const AUDIO = '/audio/tuner.mp3';
const SECONDS = 50;
const DURATION_IN_FRAMES = SECONDS * FPS;

const TUNER_PROPS: Partial<Record<PreviewKind, PreviewProps>> = {
	halo: {centerMode: 'transparent'},
	trip: {bpm: 122},
};

const TUNER_CONTROLS: Partial<Record<PreviewKind, readonly string[]>> = {
	ferrofluid: ['intensity', 'pattern', 'shineColor'],
	halo: ['intensity', 'radius', 'centerMode'],
	trip: ['pattern', 'thickness', 'baseColor'],
	liquid: ['swirl', 'distortion', 'color1'],
};

const SWATCHES: Partial<Record<PreviewKind, readonly string[]>> = {
	ferrofluid: ['#ffbc8e', '#7cc4ff', '#ff6fae', '#b9f26b', '#f2efe9'],
	trip: ['#ff00ff', '#00e5ff', '#ff5a1f', '#7dff6b', '#ffe14d'],
	liquid: ['#1e00ff', '#ff1f6b', '#00b8ff', '#8a2be2', '#ff8a00'],
};

// EXTERNAL: static/tuner/*.webp are renders of this frame; re-render them when it changes.
const POSTER_FRAME = 330;

const baseProps = (slug: PreviewKind): PreviewProps => {
	const example = examples[slug];
	return {
		...example.props,
		...TUNER_PROPS[slug],
		width: example.width,
		height: example.height,
	};
};

type VisualProps = ComponentProps<typeof PreviewRenderer>;
function TunerControl({
	control,
	value,
	swatches,
	onChange,
}: {
	control: Control;
	value: PreviewValue | undefined;
	swatches: readonly string[] | undefined;
	onChange: (value: PreviewValue) => void;
}) {
	if (control.type === 'color' && swatches)
		return (
			<Swatches
				label={control.label}
				value={String(value)}
				swatches={swatches}
				onChange={onChange}
			/>
		);
	if (control.type === 'select')
		return (
			<Segments
				label={control.label}
				options={(control.options ?? []).map((option) => ({
					value: String(option.value),
					label: option.label,
				}))}
				value={String(value)}
				onChange={onChange}
			/>
		);
	return <ControlField control={control} value={(value ?? 0) as PreviewValue} update={onChange} />;
}

const VisualContext = createContext<VisualProps | null>(null);

function TunerComposition() {
	const visual = useContext(VisualContext);
	return (
		<>
			<Html5Audio src={AUDIO} showInTimeline={false} />
			{visual && (
				<PreviewRenderer {...visual} audioSrc={AUDIO} audioOffsetInSeconds={0} playAudio={false} />
			)}
		</>
	);
}

const literal = (value: PreviewValue) =>
	typeof value === 'string' ? `"${value}"` : `{${String(value)}}`;

export default function ElementTuner({picks}: {picks: readonly Pick[]}) {
	const [selected, setSelected] = useState<PreviewKind>(picks[0]!.slug);
	const [tweaks, setTweaks] = useState<Partial<Record<PreviewKind, PreviewProps>>>({});
	const [reducedMotion] = useState(
		() =>
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches,
	);
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const rootRef = useRef<HTMLDivElement>(null);
	const playerRef = useRef<PlayerRef>(null);
	const {playerKey, retry, recover} = usePlayerRecovery(rootRef, mounted);
	const ready = usePlayerReady(playerRef, selected, mounted, playerKey);
	const {playing, muted} = usePlayerStatus(playerRef, mounted, playerKey);
	useVisiblePlayback(rootRef, playerRef, mounted, !reducedMotion, playerKey);
	const props = useMemo<VisualProps>(
		() => ({...baseProps(selected), ...tweaks[selected], previewKind: selected}),
		[selected, tweaks],
	);
	const controls = useMemo(() => {
		const keys = TUNER_CONTROLS[selected] ?? [];
		const all: readonly Control[] = examples[selected].controls;
		return keys
			.map((key) => all.find((control) => control.key === key))
			.filter(Boolean) as Control[];
	}, [selected]);
	const current = picks.find((pick) => pick.slug === selected)!;

	const update = (key: string, value: PreviewValue) =>
		setTweaks((all) => ({...all, [selected]: {...all[selected], [key]: value}}));

	const code = useMemo(() => {
		const tuned = tweaks[selected] ?? {};
		const lines = [
			{text: `import {${current.name}} from './${selected}.element';`, tuned: false},
			{text: '', tuned: false},
			{text: `<${current.name}`, tuned: false},
			{text: `  audioSrc={staticFile('track.mp3')}`, tuned: false},
			...controls.map((control) => ({
				text: `  ${control.key}=${literal(props[control.key] ?? '')}`,
				tuned: control.key in tuned,
			})),
			{text: '/>', tuned: false},
		];
		let noted = false;
		return lines.map((line) => {
			const note = line.tuned && !noted ? 'from your tweak' : undefined;
			if (line.tuned) noted = true;
			return {...line, html: highlightLine(line.text), note};
		});
	}, [controls, current.name, props, selected, tweaks]);

	return (
		<div ref={rootRef} className="stage tuner">
			<div className="stage-ambient" aria-hidden="true">
				<img src={`/tuner/${selected}.webp`} alt="" loading="lazy" />
			</div>
			<div className="stage-frame">
				<div className="stage-screen" data-ready={ready}>
					<img
						className="stage-poster"
						src={`/tuner/${selected}.webp`}
						alt=""
						loading="lazy"
						aria-hidden="true"
					/>
					{mounted && (
						<VisualContext value={props}>
							<Player
								key={playerKey}
								ref={playerRef}
								className="preview-player"
								component={TunerComposition}
								compositionWidth={PREVIEW_WIDTH}
								compositionHeight={PREVIEW_HEIGHT}
								fps={FPS}
								durationInFrames={DURATION_IN_FRAMES}
								initialFrame={POSTER_FRAME}
								autoPlay={false}
								initiallyMuted
								numberOfSharedAudioTags={0}
								loop
								clickToPlay
								doubleClickToFullscreen={false}
								style={{width: '100%', aspectRatio: '16 / 9'}}
								errorFallback={({error}) => (
									<StageError
										message={error.message}
										onRetry={retry}
										onLost={isContextLoss(error) ? recover : undefined}
									/>
								)}
							/>
						</VisualContext>
					)}
				</div>
				<div className="stage-bar">
					<div className="stage-picks" role="group" aria-label="Choose an element">
						{picks.map((pick) => (
							<button
								key={pick.slug}
								type="button"
								aria-pressed={pick.slug === selected}
								onClick={() => setSelected(pick.slug)}
							>
								<img src={`/tuner/thumbs/${pick.slug}.webp`} alt="" width="32" height="18" />
								{pick.title}
							</button>
						))}
					</div>
					<div className="stage-transport">
						<PlayButton playing={playing} onClick={(event) => playerRef.current?.toggle(event)} />
						<TrackWave
							generation={playerKey}
							playerRef={playerRef}
							mounted={mounted}
							levels={tunerWave}
							fps={FPS}
							durationInFrames={DURATION_IN_FRAMES}
							initialFrame={POSTER_FRAME}
						/>
						<SoundButton
							playing={playing}
							muted={muted}
							onClick={(event) => toggleSound(playerRef.current, event)}
						/>
					</div>
				</div>
				<div className="stage-tune">
					{controls.map((control) => {
						const swatches = SWATCHES[selected];
						const value = props[control.key];
						return (
							<div
								key={`${selected}-${control.key}`}
								className={`stage-control stage-control-${control.type}`}
							>
								<TunerControl
									control={control}
									value={value}
									swatches={swatches}
									onChange={(next) => update(control.key, next)}
								/>
							</div>
						);
					})}
				</div>
				<figure className="tuner-code" aria-label={`${current.title} in your project`}>
					<pre className="code-lines">
						<code>
							{code.map((line, index) => (
								<span
									key={index}
									className="line"
									data-tuned={line.tuned || undefined}
									data-note={line.note}
									dangerouslySetInnerHTML={{__html: line.html}}
								/>
							))}
						</code>
					</pre>
					<a className="stage-open" href={`/${selected}.html`}>
						Open {current.title}
						<span aria-hidden="true">→</span>
					</a>
				</figure>
			</div>
		</div>
	);
}
