import type {ComponentType} from 'react';
import {AbsoluteFill} from 'remotion';
import {examples, type PreviewKind} from './examples';
import type {PreviewProps as Props} from './types';

export const PREVIEW_WIDTH = 1280;
export const PREVIEW_HEIGHT = 720;
const PREVIEW_PADDING = 40;
type PreviewRendererProps = Props & {readonly previewKind: PreviewKind};

export const PreviewRenderer = ({previewKind, ...props}: PreviewRendererProps) => {
	const example = examples[previewKind];
	const Component: ComponentType<Props> = example.component;
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
