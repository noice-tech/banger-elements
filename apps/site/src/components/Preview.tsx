import {useEffect, useMemo, useRef, useState} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {createPortal} from 'react-dom';
import ExamplePicker from './ExamplePicker';
import StudioActions from './StudioActions';
import {examples, type PreviewKind} from './preview/examples';
import {PreviewRenderer, PREVIEW_WIDTH, PREVIEW_HEIGHT} from './preview/PreviewRenderer';
import {PreviewControls} from './preview/PreviewControls';
import {usePreviewAudio, usePreviewArtwork} from './preview/use-preview-assets';
import type {PreviewProps} from './preview/types';

export type {PreviewKind} from './preview/examples';

export default function Preview({
	slug,
	variants = false,
	editable = false,
	controlsTargetId,
	installTargetId,
}: {
	slug: PreviewKind;
	variants?: boolean;
	editable?: boolean;
	controlsTargetId?: string;
	installTargetId?: string;
}) {
	const [selected, setSelected] = useState<PreviewKind>(slug);
	const playerRef = useRef<PlayerRef>(null);
	const [readyKind, setReadyKind] = useState<PreviewKind | null>(null);
	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;
		let frame = 0;
		let settledFrames = 0;
		let buffering = false;
		const onWaiting = () => {
			buffering = true;
		};
		const onResume = () => {
			buffering = false;
		};
		player.addEventListener('waiting', onWaiting);
		player.addEventListener('resume', onResume);
		const revealWhenReady = () => {
			settledFrames = buffering ? 0 : settledFrames + 1;
			if (settledFrames >= 2) {
				setReadyKind(selected);
			} else {
				frame = requestAnimationFrame(revealWhenReady);
			}
		};
		frame = requestAnimationFrame(revealWhenReady);
		return () => {
			cancelAnimationFrame(frame);
			player.removeEventListener('waiting', onWaiting);
			player.removeEventListener('resume', onResume);
		};
	}, [selected]);
	const example = examples[selected];
	const durationInSeconds =
		selected === 'vhs' ||
		selected === 'ferrofluid' ||
		selected === 'trip' ||
		selected === 'fractals' ||
		selected === 'hyperloop' ||
		selected === 'downfall' ||
		selected === 'rail' ||
		selected === 'rain' ||
		selected === 'space' ||
		selected === 'synthwave' ||
		selected === 'mushrooms' ||
		selected === 'halo' ||
		selected === 'audio-particles' ||
		selected === 'combined'
			? 16
			: 9;
	const initialProps = useMemo<PreviewProps>(
		() => ({...example.props, width: example.width, height: example.height}),
		[example],
	);
	const [customProps, setCustomProps] = useState<PreviewProps>(initialProps);
	const audio = usePreviewAudio(selected);
	const artwork = usePreviewArtwork();
	const {artworkFile, setArtworkFile, localArtwork} = artwork;
	const {audioUrl, localAudio} = audio;

	useEffect(() => {
		setCustomProps(initialProps);
		setArtworkFile(null);
	}, [initialProps, setArtworkFile]);

	const inputProps = useMemo<PreviewProps>(
		() => ({
			...customProps,
			...(selected === 'halo'
				? {artworkSrc: artworkFile ? (localArtwork?.url ?? '') : (customProps.artworkSrc ?? '')}
				: {}),
			audioSrc: localAudio?.url ?? audioUrl,
			audioOffsetInSeconds: Number(customProps.audioOffsetInSeconds ?? 0),
			playAudio: Boolean(customProps.playAudio ?? true),
		}),
		[audioUrl, customProps, localAudio, selected, artworkFile, localArtwork],
	);
	const reset = () => {
		audio.resetAudio();
		setArtworkFile(null);
		setCustomProps(initialProps);
	};
	const controlsTarget =
		controlsTargetId && typeof document !== 'undefined'
			? document.getElementById(controlsTargetId)
			: null;

	const installTarget =
		installTargetId && typeof document !== 'undefined'
			? document.getElementById(installTargetId)
			: null;

	return (
		<div className="preview-block not-content">
			{installTarget
				? createPortal(
						<StudioActions
							slug={selected}
							previewProps={inputProps}
							assetPending={Boolean(artworkFile)}
						/>,
						installTarget,
					)
				: null}
			<div className="preview-stage" data-ready={readyKind === selected}>
				<Player
					ref={playerRef}
					className="preview-player"
					key={selected}
					component={PreviewRenderer}
					inputProps={{...inputProps, previewKind: selected}}
					compositionWidth={PREVIEW_WIDTH}
					compositionHeight={PREVIEW_HEIGHT}
					fps={60}
					durationInFrames={durationInSeconds * 60}
					initialFrame={0}
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
				<span>60 FPS · {durationInSeconds} seconds · Press play to hear audio</span>
				<span>
					{selected === 'vhs'
						? 'Demo children are not included. Wrap your own JSX after installation.'
						: 'Studio uses your preview settings. Download TSX uses the original defaults.'}
				</span>
			</div>
			{variants ? <ExamplePicker selected={selected} onSelect={setSelected} /> : null}
			{editable && controlsTarget
				? createPortal(
						<PreviewControls
							slug={selected}
							customProps={customProps}
							inputProps={inputProps}
							setCustomProps={setCustomProps}
							reset={reset}
							audio={audio}
							artwork={artwork}
						/>,
						controlsTarget,
					)
				: null}
		</div>
	);
}
