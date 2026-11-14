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

const wrapperSlugs = new Set(['vhs', 'fisheye', 'wet-glass']);
export const isWrapper = (slug: string) => wrapperSlugs.has(slug);

export function isControlVisible(slug: string, props: Record<string, PreviewValue>, key: string) {
	if (slug === 'waveform' && key === 'color') return props.colorMode !== 'frequency';
	if (slug === 'oscilloscope' && key === 'timeSpanMs') return props.displayMode !== 'single-cycle';
	if (slug !== 'circle' && slug !== 'spectre') return true;
	if (key === 'middleColor') return props.colorMode === 'gradient-3';
	if (['startColor', 'endColor'].includes(key)) return props.colorMode !== 'rainbow';
	if (['rainbowSpeed', 'saturation', 'brightness'].includes(key))
		return props.colorMode === 'rainbow';
	if (slug === 'spectre') return key !== 'segmentGap' || props.spectreVariant === 'segmented';
	const variant = props.circleVariant ?? 'radial-bars';
	if (key === 'count') return variant === 'radial-bars' || variant === 'dotted-ring';
	if (key === 'barWidth') return variant === 'radial-bars';
	if (key === 'lineWidth' || key === 'showLines') return variant === 'glow-ring';
	if (key === 'lineThickness') return variant === 'waveform-ring';
	if (key === 'dotSize') return variant === 'dotted-ring';
	return true;
}

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
	if (wrapperSlugs.has(slug)) {
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
	const ending = wrapperSlugs.has(slug)
		? `>\n  {/* Move your existing Elements and text here. Stack layers with position: 'absolute'. */}\n</${name}>`
		: '/>';
	return `import {${name}} from './${slug}.element';\n\n${notes.length ? `${notes.join('\n')}\n` : ''}// Inside your Remotion composition:\n<${name}\n${attributes}\n${ending}`;
}
