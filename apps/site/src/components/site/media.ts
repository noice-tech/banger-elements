import {useEffect, useRef, type FocusEvent, type PointerEvent, type RefObject} from 'react';

export const SYNC_MEDIA_EVENT = 'showcase:sync-media';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)');

/** Plays a muted loop while it is on screen; videos with controls stay paused once the viewer pauses them. */
export const usePlayWhileVisible = (ref: RefObject<HTMLVideoElement | null>) => {
	useEffect(() => {
		const video = ref.current;
		if (!video) return;
		const motion = reducedMotion();
		let visible = false;
		let pausedHere = false;
		let pausedByUser = false;
		const pause = () => {
			if (video.paused) return;
			pausedHere = true;
			video.pause();
		};
		const sync = () => {
			const onScreen = !document.hidden && visible && !video.closest('[hidden]');
			if (!onScreen) pause();
			else if (video.controls && (motion.matches || pausedByUser)) return;
			else if (motion.matches) pause();
			else void video.play().catch(() => {});
		};
		const onPause = () => {
			if (pausedHere) pausedHere = false;
			else if (video.controls) pausedByUser = true;
		};
		const onPlay = () => {
			pausedByUser = false;
		};
		const observer = new IntersectionObserver(
			([entry]) => {
				visible = Boolean(entry?.isIntersecting);
				sync();
			},
			{threshold: 0.15},
		);
		observer.observe(video);
		video.addEventListener('pause', onPause);
		video.addEventListener('play', onPlay);
		motion.addEventListener('change', sync);
		document.addEventListener('visibilitychange', sync);
		document.addEventListener(SYNC_MEDIA_EVENT, sync);
		return () => {
			observer.disconnect();
			video.removeEventListener('pause', onPause);
			video.removeEventListener('play', onPlay);
			motion.removeEventListener('change', sync);
			document.removeEventListener('visibilitychange', sync);
			document.removeEventListener(SYNC_MEDIA_EVENT, sync);
		};
	}, [ref]);
};

/** Plays a preview only while its card is hovered or focused, then rewinds it to the poster. */
export const useHoverPlay = () => {
	const video = useRef<HTMLVideoElement>(null);
	const start = () => {
		if (video.current && !reducedMotion().matches) void video.current.play().catch(() => {});
	};
	const stop = () => {
		if (!video.current) return;
		video.current.pause();
		video.current.currentTime = 0;
	};
	return {
		video,
		hoverProps: {
			onPointerEnter: (event: PointerEvent) => {
				if (event.pointerType !== 'touch') start();
			},
			onPointerLeave: stop,
			onFocus: start,
			onBlur: (event: FocusEvent) => {
				if (!event.currentTarget.contains(event.relatedTarget)) stop();
			},
		},
	};
};
