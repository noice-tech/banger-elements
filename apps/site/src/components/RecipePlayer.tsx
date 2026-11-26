import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {AbsoluteFill, Html5Video} from 'remotion';
import {useVisiblePlayback} from './stage/parts';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const fill: CSSProperties = {width: '100%', height: '100%', objectFit: 'cover'};

const playersSharingSound = new Set<PlayerRef>();
const renderPoster = () => <div className="recipe-poster" />;

function RecipeVideo({src}: {src: string}) {
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Html5Video src={src} style={fill} />
		</AbsoluteFill>
	);
}

/** Plays an example's pre-rendered clip. It is not a live render: some
 * examples take over a minute to render, far too slow for a browser. */
export function RecipePlayer({
	src,
	poster,
	title,
	width,
	height,
	fps,
	durationInFrames,
	silent = false,
}: {
	src: string;
	poster: string;
	title: string;
	width: number;
	height: number;
	fps: number;
	durationInFrames: number;
	silent?: boolean;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const playerRef = useRef<PlayerRef>(null);
	const [mounted, setMounted] = useState(false);
	const [autoPlay, setAutoPlay] = useState(false);

	useEffect(() => {
		setAutoPlay(!window.matchMedia(REDUCED_MOTION).matches);
		setMounted(true);
	}, []);
	useVisiblePlayback(rootRef, playerRef, mounted, autoPlay);

	useEffect(() => {
		const player = playerRef.current;
		if (!mounted || !player) return;
		playersSharingSound.add(player);
		const muteOthers = (event: {detail: {isMuted: boolean}}) => {
			if (event.detail.isMuted) return;
			for (const other of playersSharingSound)
				if (other !== player && !other.isMuted()) other.mute();
		};
		player.addEventListener('mutechange', muteOthers);
		return () => {
			playersSharingSound.delete(player);
			player.removeEventListener('mutechange', muteOthers);
		};
	}, [mounted]);

	return (
		<div
			ref={rootRef}
			className="recipe-screen"
			role="region"
			aria-label={`${title} video`}
			style={{'--poster': `url(${poster})`} as CSSProperties}
		>
			{mounted ? (
				<Player
					ref={playerRef}
					component={RecipeVideo}
					inputProps={{src}}
					compositionWidth={width}
					compositionHeight={height}
					fps={fps}
					durationInFrames={durationInFrames}
					controls
					loop
					initiallyMuted
					showVolumeControls={!silent}
					allowFullscreen
					clickToPlay
					doubleClickToFullscreen
					// EXTERNAL: with this on, Remotion focuses the play button on every play or pause.
					spaceKeyToPlayOrPause={false}
					renderPoster={renderPoster}
					showPosterWhenUnplayed
					style={{width: '100%', height: '100%'}}
				/>
			) : null}
		</div>
	);
}
