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
	if (localAudio || String(safeProps.audioSrc ?? '').startsWith('blob:')) {
		safeProps.audioSrc = '/audio/your-track.mp3';
	}
	const attributes = Object.entries(safeProps)
		.filter(([, value]) => typeof value !== 'number' || Number.isFinite(value))
		.map(([key, value]) => `  ${key}={${JSON.stringify(value)}}`)
		.join('\n');
	return `import {${name}} from './${slug}.element';\n\n${localAudio ? '// Replace /audio/your-track.mp3 with your project audio asset.\n' : ''}// Inside your Remotion composition:\n<${name}\n${attributes}\n/>`;
}
