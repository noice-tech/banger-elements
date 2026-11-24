import type {StudioElementPayload} from '@remotion/studio-protocol';
import type {PreviewValue} from './preview-config';

export type SourcePayload = StudioElementPayload & {
	sourceSettings: Record<string, {start: number; end: number; value: unknown}>;
};

// Shaders fill their composition (payload dimensions are null). The preview stage is
// 1280x720, so only a size the user changed is installed as an explicit size.
const FILL_PREVIEW_SIZE = {width: 1280, height: 720};

export function configuredPayload(
	template: SourcePayload,
	props: Record<string, PreviewValue>,
): StudioElementPayload {
	let sourceCode = template.element.sourceCode;
	const edits = Object.entries(props).flatMap(([key, value]) => {
		const setting = template.sourceSettings[key];
		if (!setting || setting.value === value) return [];
		if (typeof value === 'number' && !Number.isFinite(value))
			throw new Error('Enter a valid number.');
		if (typeof value === 'string' && value.startsWith('blob:'))
			throw new Error('Use a hosted asset URL before you install this element.');
		return [{...setting, text: JSON.stringify(value)}];
	});
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		sourceCode = sourceCode.slice(0, edit.start) + edit.text + sourceCode.slice(edit.end);
	}

	// The demo track is copied into the project only while the source still uses it.
	const ownAudio =
		'audioSrc' in props && props.audioSrc !== template.sourceSettings.audioSrc?.value;
	const initialProps: Record<string, unknown> = {...template.element.initialProps};
	if (ownAudio) delete initialProps.audioSrc;
	const assets = ownAudio ? [] : template.element.assets;

	const size = {width: Number(props.width), height: Number(props.height)};
	const fills = template.element.dimensions === null;
	const fixedSize =
		!fills || size.width !== FILL_PREVIEW_SIZE.width || size.height !== FILL_PREVIEW_SIZE.height;
	if (fills && fixedSize) {
		if (!Number.isFinite(size.width) || !Number.isFinite(size.height))
			throw new Error('Enter a valid number.');
		initialProps.width = size.width;
		initialProps.height = size.height;
	}

	return {
		type: template.type,
		version: template.version,
		durationInFrames: template.durationInFrames,
		element: {
			...template.element,
			sourceCode,
			assets,
			initialProps: Object.keys(initialProps).length
				? (initialProps as StudioElementPayload['element']['initialProps'])
				: null,
			dimensions: fixedSize ? size : null,
		},
	};
}
