import {useEffect, useMemo, useRef, useState} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {createPortal} from 'react-dom';
import StudioActions from './StudioActions';
import {examples, playbackAudio, type PreviewKind} from './preview/examples';
import {PreviewRenderer, PREVIEW_WIDTH, PREVIEW_HEIGHT} from './preview/PreviewRenderer';
import {PreviewControls} from './preview/PreviewControls';
import {usePreviewAudio, usePreviewArtwork} from './preview/use-preview-assets';
import type {PreviewProps} from './preview/types';
import {isWrapper as isWrapperElement} from './preview-config';
import {previewDurationInSeconds, usePlayerReady} from './preview/player';
import {isPictureClick} from './stage/parts';

export type {PreviewKind} from './preview/examples';

export default function Preview({
	slug,
	editable = false,
	controlsTargetId,
	installTargetId,
}: {
	slug: PreviewKind;
	editable?: boolean;
	controlsTargetId?: string;
	installTargetId?: string;
}) {
	const selected = slug;
	const playerRef = useRef<PlayerRef>(null);
	const ready = usePlayerReady(playerRef, selected);
	const example = examples[selected];
	const isWrapper = isWrapperElement(selected);
	const durationInSeconds = previewDurationInSeconds(selected);
	const initialProps = useMemo<PreviewProps>(
		() => ({...example.props, width: example.width, height: example.height}),
		[example],
	);
	// EXTERNAL: Remotion fades controls in on hover; on touch the first tap only revealed them.
	const [touchOnly] = useState(() => window.matchMedia('(hover: none)').matches);
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
			<div
				className="preview-stage"
				data-ready={ready}
				onClick={(event) => {
					const target = event.target as Element;
					if (target.closest('.__remotion-player') && isPictureClick(event))
						playerRef.current?.toggle(event);
				}}
			>
				<Player
					ref={playerRef}
					className="preview-player"
					key={selected}
					component={PreviewRenderer}
					inputProps={{
						...inputProps,
						audioSrc: playbackAudio(String(inputProps.audioSrc)),
						previewKind: selected,
					}}
					compositionWidth={PREVIEW_WIDTH}
					compositionHeight={PREVIEW_HEIGHT}
					fps={60}
					durationInFrames={durationInSeconds * 60}
					initialFrame={0}
					controls
					alwaysShowControls={touchOnly}
					clickToPlay={false}
					// EXTERNAL: with this on, Remotion focuses the play button on every play or pause.
					spaceKeyToPlayOrPause={false}
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
					{isWrapper
						? 'Demo children are not included. Wrap your own JSX after installation.'
						: 'Studio uses your preview settings. Download TSX uses the original defaults.'}
				</span>
			</div>
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
