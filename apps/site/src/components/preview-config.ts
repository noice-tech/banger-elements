export type PreviewValue = string | number | boolean;

const advancedKeys = new Set([
	'shineX',
	'shineY',
	'shineZ',
	'shineIntensity',
	'shineSize',
	'roughness',
	'iridescence',
	'envMapIntensity',
	'quality',
	'mappingMode',
	'audioLights',
	'autoRotate',
	'rotationSpeed',
	'sampleCount',
	'trailDepth',
	'waveDelay',
	'motionBlur',
	'glowBlur',
	'glowSpread',
	'maskHalo',
]);

export const isAdvancedControl = (key: string) => advancedKeys.has(key);

export function configuredJsx(
	slug: string,
	props: Record<string, PreviewValue>,
	localAudio: boolean,
) {
	const name = slug
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
	const safeProps = {...props};
	// VHS owns no audio: those controls belong only to the demo children.
	if (slug === 'vhs') {
		delete safeProps.audioSrc;
		delete safeProps.audioOffsetInSeconds;
		delete safeProps.playAudio;
		localAudio = false;
	}
	const replaceAudio = localAudio || String(safeProps.audioSrc ?? '').startsWith('blob:');
	const replaceArtwork = String(safeProps.artworkSrc ?? '').startsWith('blob:');
	if (replaceAudio) safeProps.audioSrc = '/audio/your-track.mp3';
	if (replaceArtwork) safeProps.artworkSrc = '/images/your-artwork.png';
	const notes = [
		...(replaceAudio ? ['// Replace /audio/your-track.mp3 with your project audio asset.'] : []),
		...(replaceArtwork
			? ['// Replace /images/your-artwork.png with your project image asset.']
			: []),
	];
	const attributes = Object.entries(safeProps)
		.filter(([, value]) => typeof value !== 'number' || Number.isFinite(value))
		.map(([key, value]) => `  ${key}={${JSON.stringify(value)}}`)
		.join('\n');
	const ending =
		slug === 'vhs'
			? `>\n  {/* Move your existing Elements and text here. Stack layers with position: 'absolute'. */}\n</${name}>`
			: '/>';
	return `import {${name}} from './${slug}.element';\n\n${notes.length ? `${notes.join('\n')}\n` : ''}// Inside your Remotion composition:\n<${name}\n${attributes}\n${ending}`;
}
