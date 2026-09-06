const spectreCode = (variant: string) => `import {Spectre} from './spectre.element';

// Inside your Remotion composition:
<Spectre spectreVariant="${variant}" />`;
const circleCode = (variant: string, props = '') => `import {Circle} from './circle.element';

// Inside your Remotion composition:
<Circle circleVariant="${variant}"${props} />`;

export const examplePresets = [
	{
		id: 'spectre',
		group: 'Spectre',
		label: 'Frequency bars',
		description: 'A frequency spectrum with continuous bars and a color gradient.',
		code: spectreCode('bars'),
		links: [{label: 'Open Spectre', href: '/spectre.html'}],
	},
	{
		id: 'segmented',
		group: 'Spectre',
		label: 'Segmented',
		description: 'A frequency spectrum divided into small, stacked segments.',
		code: spectreCode('segmented'),
		links: [{label: 'Open Spectre', href: '/spectre.html'}],
	},
	{
		id: 'circle',
		group: 'Circle',
		label: 'Radial bars',
		description: 'Frequency bars arranged around a circle, expanding with the music.',
		code: circleCode('radial-bars'),
		links: [{label: 'Open Circle', href: '/circle.html'}],
	},
	{
		id: 'glow',
		group: 'Circle',
		label: 'Glow ring',
		description: 'A soft, luminous ring that responds to your audio.',
		code: circleCode('glow-ring'),
		links: [{label: 'Open Circle', href: '/circle.html'}],
	},
	{
		id: 'ring-waveform',
		group: 'Circle',
		label: 'Waveform ring',
		description: 'An audio waveform wrapped around a circular path.',
		code: circleCode('waveform-ring'),
		links: [{label: 'Open Circle', href: '/circle.html'}],
	},
	{
		id: 'dotted',
		group: 'Circle',
		label: 'Dotted ring',
		description: 'A reactive ring built from individual dots instead of continuous lines.',
		code: circleCode('dotted-ring', ' count={48} lineWidth={1}'),
		links: [{label: 'Open Circle', href: '/circle.html'}],
	},
	{
		id: 'combined',
		group: 'Combined',
		label: 'Halo + Audio Particles',
		description:
			'Layer glowing trails with bass-reactive particles. Install both elements separately and keep audio playback enabled on only one.',
		code: `import {AbsoluteFill, staticFile} from 'remotion';
import {Halo} from './halo.element';
import {AudioParticles} from './audio-particles.element';

// Add your track to public/my-track.mp3.
// Use a 1280 × 720 composition.
export const HaloAndParticles = () => {
  const audioSrc = staticFile('my-track.mp3');
  return (
    <AbsoluteFill style={{backgroundColor: '#080a10'}}>
      <Halo
        audioSrc={audioSrc}
        intensity={1} inputGainDb={0} radius={0.12}
        colorMode="rainbow" trailDepth={9}
      />
      <AudioParticles
        audioSrc={audioSrc} playAudio={false}
        width={1280} height={720} maskHalo radius={0.12}
        inputGainDb={0} intensity={1} density={45} size={1.5}
      />
    </AbsoluteFill>
  );
};`,
		links: [
			{label: 'Open Halo', href: '/halo.html'},
			{label: 'Open Audio Particles', href: '/audio-particles.html'},
		],
	},
] as const;

export type ExampleId = (typeof examplePresets)[number]['id'];
export const exampleGroups = ['Spectre', 'Circle', 'Combined'] as const;
