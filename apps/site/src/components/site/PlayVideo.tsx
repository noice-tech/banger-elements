import {useRef, type ComponentProps} from 'react';
import {usePlayWhileVisible} from './media';

/** A muted loop that plays only while it is on screen. */
export const PlayVideo = ({ref: outer, ...props}: ComponentProps<'video'>) => {
	const ref = useRef<HTMLVideoElement>(null);
	usePlayWhileVisible(ref);
	return (
		<video
			ref={(video) => {
				ref.current = video;
				if (typeof outer === 'function') outer(video);
				else if (outer) outer.current = video;
			}}
			{...props}
		/>
	);
};
