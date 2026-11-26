import {ELEMENT_PAYLOAD_MIME_TYPE, serializeElementPayloadForHtml} from '@remotion/studio-protocol';
import type {SourcePayload} from '../components/configured-source';

const payloads = import.meta.glob<SourcePayload>(
	'../../../../packages/elements/dist/payloads/*.json',
	{eager: true, import: 'default'},
);

export const elementPayloadMimeType = ELEMENT_PAYLOAD_MIME_TYPE;

function payloadFor(slug: string): SourcePayload {
	const entry = Object.entries(payloads).find(([file]) => file.endsWith(`/payloads/${slug}.json`));
	if (!entry)
		throw new Error(`Missing Studio payload for ${slug}. Run the collection build first.`);
	return entry[1];
}

export function elementPayloadHtml(slug: string): string {
	const {type, version, durationInFrames, element} = payloadFor(slug);
	return serializeElementPayloadForHtml({type, version, durationInFrames, element});
}

/** The project file that an install copies the Element's default texture to, if it has one. */
export function elementTextureFile(slug: string): string | null {
	const {element, sourceSettings} = payloadFor(slug);
	const texture = sourceSettings.textureSrc?.value;
	const asset = element.assets.find((entry) => entry.type === 'url' && entry.url === texture);
	return asset ? `public/${asset.path}` : null;
}
