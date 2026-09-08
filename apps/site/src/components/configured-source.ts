import type {StudioElementPayload} from '@remotion/studio-protocol';
import type {PreviewValue} from './preview-config';

export type SourcePayload = StudioElementPayload & {
	sourceSettings: Record<string, {start: number; end: number; value: unknown}>;
};

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
	return {
		type: template.type,
		version: template.version,
		durationInFrames: template.durationInFrames,
		element: {
			...template.element,
			sourceCode,
			dimensions: {width: Number(props.width), height: Number(props.height)},
		},
	};
}
