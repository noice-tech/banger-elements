import type {StudioElementPayload} from '@remotion/studio-protocol';
import type {PreviewValue} from './preview-config';

export type SourcePayload = StudioElementPayload & {
	sourceSettings: Record<string, {start: number; end: number; value: unknown}>;
};

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

	const initialProps: Record<string, unknown> = {...template.element.initialProps};
	let assets = template.element.assets;
	for (const prop of Object.keys(initialProps)) {
		const setting = template.sourceSettings[prop];
		if (!setting || !(prop in props) || props[prop] === setting.value) continue;
		delete initialProps[prop];
		assets = assets.filter((asset) => asset.type !== 'url' || asset.url !== setting.value);
	}

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
