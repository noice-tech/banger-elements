import {
	ELEMENT_PAYLOAD_MIME_TYPE,
	serializeElementPayloadForHtml,
	type StudioElementPayload,
} from '@remotion/studio-protocol';

// Build-time only: each Element page embeds its own payload so `npx remotion elements use <url>`
// and agents can install from the page HTML. Gallery pages link here instead of embedding.
const payloads = import.meta.glob<StudioElementPayload & {sourceSettings?: unknown}>(
	'../../../../packages/elements/dist/payloads/*.json',
	{eager: true, import: 'default'},
);

export const elementPayloadMimeType = ELEMENT_PAYLOAD_MIME_TYPE;

export function elementPayloadHtml(slug: string): string {
	const entry = Object.entries(payloads).find(([file]) => file.endsWith(`/payloads/${slug}.json`));
	if (!entry)
		throw new Error(`Missing Studio payload for ${slug}. Run the collection build first.`);
	// Keep only protocol fields. sourceSettings drives the site's preview-to-source edits.
	const {type, version, durationInFrames, element} = entry[1];
	return serializeElementPayloadForHtml({type, version, durationInFrames, element});
}
