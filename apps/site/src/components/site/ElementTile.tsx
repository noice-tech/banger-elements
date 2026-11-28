import type {DragEvent} from 'react';
import {Link} from 'react-router';
import {elementPath} from '../../lib/site';
import {useHoverPlay} from './media';

export const ElementTile = ({
	slug,
	title,
	tagline,
	hidden,
	sending,
	sent,
	onWarm,
	onUse,
	onDrag,
}: {
	slug: string;
	title: string;
	tagline: string;
	hidden: boolean;
	sending: boolean;
	sent: boolean;
	onWarm: () => void;
	onUse: () => void;
	onDrag: (event: DragEvent) => void;
}) => {
	const {video, hoverProps} = useHoverPlay();
	return (
		<div
			className="tile-item"
			hidden={hidden}
			{...hoverProps}
			onPointerEnter={(event) => {
				onWarm();
				hoverProps.onPointerEnter(event);
			}}
			onFocus={() => {
				onWarm();
				hoverProps.onFocus();
			}}
		>
			<Link className="tile" to={elementPath(slug)} draggable onDragStart={onDrag}>
				<video
					ref={video}
					muted
					loop
					playsInline
					preload="none"
					poster={`/posters/${slug}.webp`}
					aria-hidden="true"
				>
					<source src={`/previews/${slug}.webm`} type="video/webm" />
				</video>
				<span className="tile-shade" aria-hidden="true"></span>
				<span className="tile-copy">
					<span className="tile-title">{title}</span>
					<span className="tile-tagline">{tagline}</span>
				</span>
			</Link>
			<button
				className="tile-use"
				type="button"
				aria-label={`Use ${title} in Studio`}
				aria-busy={sending || undefined}
				disabled={sending}
				onClick={onUse}
			>
				{sent ? 'Sent' : 'Use'}
			</button>
		</div>
	);
};
