import {useEffect, useState, type RefObject} from 'react';
import type {PlayerRef} from '@remotion/player';
import type {PreviewKind} from './examples';
import {isWrapper} from '../preview-config';

const LONG_PREVIEWS: readonly string[] = [
	'ferrofluid',
	'trip',
	'fractals',
	'hyperloop',
	'downfall',
	'rail',
	'rain',
	'space',
	'synthwave',
	'mushrooms',
	'halo',
	'audio-particles',
	'combined',
];

export const previewDurationInSeconds = (kind: PreviewKind) =>
	isWrapper(kind) || LONG_PREVIEWS.includes(kind) ? 16 : 9;

/**
 * Reports which preview kind has rendered two settled frames, so the player can
 * fade in without flashing a half-loaded first frame.
 */
export function usePlayerReady<K extends string>(
	playerRef: RefObject<PlayerRef | null>,
	kind: K,
	mounted = true,
) {
	const [readyKind, setReadyKind] = useState<K | null>(null);
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
			if (settledFrames >= 2) setReadyKind(kind);
			else frame = requestAnimationFrame(revealWhenReady);
		};
		frame = requestAnimationFrame(revealWhenReady);
		return () => {
			cancelAnimationFrame(frame);
			player.removeEventListener('waiting', onWaiting);
			player.removeEventListener('resume', onResume);
		};
	}, [playerRef, kind, mounted]);
	return readyKind === kind;
}
