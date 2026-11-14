import type {ComponentProps} from 'react';
import {
	Pulse,
	Rooftop,
	Cathedral,
	Liquid,
	Chrome,
	Neuron,
	Matrix,
} from '../../../../../packages/elements/dist/components';
import {color, range, numberControl, type Control} from './controls';
export const shaderExamples = {
	pulse: {
		component: Pulse,
		width: 1280,
		height: 720,
		props: {
			startColor: '#ff00ff',
			endColor: '#00ffff',
			tunnelDepth: 2,
			twist: 2,
			layers: 3,
			responsive: 2,
			glow: 1.5,
			particles: 25,
			warp: 0.5,
			speed: 1,
			bpm: 120,
			timeOffsetInSeconds: 0,
		},
		controls: [
			color('startColor', 'Primary Color'),
			color('endColor', 'Secondary Color'),
			range('tunnelDepth', 'Tunnel depth', 0.5, 8, 0.5),
			range('twist', 'Twist', 0, 10, 0.5),
			range('layers', 'Layers', 1, 6, 1),
			range('responsive', 'Audio reactivity', 0, 10, 0.5),
			range('glow', 'Glow', 0, 3, 0.25),
			range('particles', 'Particles', 0, 50, 5),
			range('warp', 'Warp', 0, 2, 0.1),
			range('speed', 'Speed', 0.1, 3, 0.1),
			range('bpm', 'Tempo (BPM)', 1, 300, 1),
			numberControl(
				'timeOffsetInSeconds',
				'Animation phase offset (independent of audio trim)',
				0,
				86400,
				0.01,
			),
			range('inputGainDb', 'Visual gain', -30, 30, 1),
		],
	} satisfies {
		component: typeof Pulse;
		width: number;
		height: number;
		props: Partial<ComponentProps<typeof Pulse>>;
		controls: readonly Control<Extract<keyof ComponentProps<typeof Pulse>, string>>[];
	},
	rooftop: {
		component: Rooftop,
		width: 1280,
		height: 720,
		props: {
			skyColor: '#0a0a1a',
			buildingColor: '#1a1a2e',
			streetColor: '#0d0d15',
			lightColor: '#ffaa44',
			cameraHeight: 3,
			gridDensity: 2,
			carDensity: 25,
			responsive: 2,
			speed: 1,
			fog: 0.5,
			bpm: 120,
			timeOffsetInSeconds: 0,
		},
		controls: [
			color('skyColor', 'Atmosphere Color'),
			color('buildingColor', 'Boxes Color'),
			color('streetColor', 'Lines Color'),
			color('lightColor', 'Light Color'),
			range('cameraHeight', 'Camera Height', 1, 10, 0.5),
			range('gridDensity', 'Grid Density', 1, 5, 0.5),
			range('carDensity', 'Lights Density', 0, 50, 5),
			range('responsive', 'Audio Reactivity', 0, 10, 0.5),
			range('speed', 'Speed', 0.1, 3, 0.1),
			range('fog', 'Fog', 0, 2, 0.1),
			range('bpm', 'Tempo (BPM)', 1, 300, 1),
			numberControl(
				'timeOffsetInSeconds',
				'Animation phase offset (independent of audio trim)',
				0,
				86400,
				0.01,
			),
			range('inputGainDb', 'Visual gain', -30, 30, 1),
		],
	} satisfies {
		component: typeof Rooftop;
		width: number;
		height: number;
		props: Partial<ComponentProps<typeof Rooftop>>;
		controls: readonly Control<Extract<keyof ComponentProps<typeof Rooftop>, string>>[];
	},
	cathedral: {
		component: Cathedral,
		width: 1280,
		height: 720,
		props: {
			stoneColor: '#6b6bff',
			glassColor1: '#4f4f4f',
			glassColor2: '#3366ff',
			lightColor: '#ffcc88',
			speed: 0.5,
			columnScale: 1,
			glassGlow: 2,
			responsive: 2,
			fog: 1,
			bpm: 120,
			timeOffsetInSeconds: 0,
		},
		controls: [
			color('stoneColor', 'Stone Color'),
			color('glassColor1', 'Glass Color 1'),
			color('glassColor2', 'Glass Color 2'),
			color('lightColor', 'Light Color'),
			range('speed', 'Speed', 0.1, 2, 0.1),
			range('columnScale', 'Column Scale', 0.5, 2, 0.1),
			range('glassGlow', 'Glass Glow', 0.5, 5, 0.5),
			range('responsive', 'Audio Reactivity', 0, 10, 0.5),
			range('fog', 'Fog', 0, 2, 0.1),
			range('bpm', 'Tempo (BPM)', 1, 300, 1),
			numberControl(
				'timeOffsetInSeconds',
				'Animation phase offset (independent of audio trim)',
				0,
				86400,
				0.01,
			),
			range('inputGainDb', 'Visual gain', -30, 30, 1),
		],
	} satisfies {
		component: typeof Cathedral;
		width: number;
		height: number;
		props: Partial<ComponentProps<typeof Cathedral>>;
		controls: readonly Control<Extract<keyof ComponentProps<typeof Cathedral>, string>>[];
	},
	liquid: {
		component: Liquid,
		width: 1280,
		height: 720,
		props: {
			color1: '#1e00ff',
			color2: '#73ff00',
			glowColor: '#d6d6d6',
			speed: 0.5,
			swirl: 1,
			distortion: 0.3,
			tunnelRadius: 2,
			responsive: 0,
			fog: 0.5,
			bpm: 120,
			timeOffsetInSeconds: 0,
		},
		controls: [
			color('color1', 'Color 1'),
			color('color2', 'Color 2'),
			color('glowColor', 'Glow Color'),
			range('speed', 'Speed', 0.1, 2, 0.1),
			range('swirl', 'Swirl', 0, 3, 0.1),
			range('distortion', 'Distortion', 0, 1.5, 0.1),
			range('tunnelRadius', 'Tunnel Size', 1, 5, 0.5),
			range('responsive', 'Audio Reactivity', 0, 2, 0.01),
			range('fog', 'Fog', 0, 2, 0.1),
			range('bpm', 'Tempo (BPM)', 1, 300, 1),
			numberControl(
				'timeOffsetInSeconds',
				'Animation phase offset (independent of audio trim)',
				0,
				86400,
				0.01,
			),
			range('inputGainDb', 'Visual gain', -30, 30, 1),
		],
	} satisfies {
		component: typeof Liquid;
		width: number;
		height: number;
		props: Partial<ComponentProps<typeof Liquid>>;
		controls: readonly Control<Extract<keyof ComponentProps<typeof Liquid>, string>>[];
	},
	chrome: {
		component: Chrome,
		width: 1280,
		height: 720,
		props: {
			color1: '#c0c0c0',
			color2: '#d4af37',
			color3: '#b87333',
			textureSrc: '',
			textureScale: 1,
			textureBlend: 0.5,
			warpIntensity: 1,
			warpSpeed: 1,
			colorCycle: 0.5,
			bumpStrength: 0.05,
			specularPower: 12,
			responsive: 2,
			lightMovement: 1,
			bpm: 120,
			timeOffsetInSeconds: 0,
		},
		controls: [
			color('color1', 'Metal Color 1'),
			color('color2', 'Metal Color 2'),
			color('color3', 'Metal Color 3'),
			range('textureScale', 'Texture Scale', 0.5, 10, 0.5),
			range('textureBlend', 'Texture Blend', 0, 1, 0.1),
			range('warpIntensity', 'Warp Intensity', 0.1, 3, 0.1),
			range('warpSpeed', 'Flow Speed', 0.1, 3, 0.1),
			range('colorCycle', 'Color Cycle', 0, 2, 0.1),
			range('bumpStrength', 'Bump Depth', 0.01, 0.15, 0.01),
			range('specularPower', 'Specular Sharpness', 4, 32, 2),
			range('responsive', 'Audio Reactivity', 0, 10, 0.5),
			range('lightMovement', 'Light Movement', 0, 2, 0.1),
			range('bpm', 'Tempo (BPM)', 1, 300, 1),
			numberControl(
				'timeOffsetInSeconds',
				'Animation phase offset (independent of audio trim)',
				0,
				86400,
				0.01,
			),
			range('inputGainDb', 'Visual gain', -30, 30, 1),
		],
	} satisfies {
		component: typeof Chrome;
		width: number;
		height: number;
		props: Partial<ComponentProps<typeof Chrome>>;
		controls: readonly Control<Extract<keyof ComponentProps<typeof Chrome>, string>>[];
	},
	neuron: {
		component: Neuron,
		width: 1280,
		height: 720,
		props: {
			color1: '#3b82f6',
			color2: '#f97316',
			glowColor: '#ec4899',
			speed: 0.5,
			scale: 1,
			thickness: 1,
			reflection: 0.5,
			fog: 0.5,
			responsive: 2,
			cameraMovement: 2.5,
			bpm: 120,
			timeOffsetInSeconds: 0,
		},
		controls: [
			color('color1', 'Color 1'),
			color('color2', 'Color 2'),
			color('glowColor', 'Glow Color'),
			range('speed', 'Speed', 0.1, 25, 0.1),
			range('scale', 'Scale', 0.5, 3, 0.1),
			range('thickness', 'Thickness', 0.5, 1.3, 0.01),
			range('reflection', 'Reflection', 0, 1, 0.1),
			range('fog', 'Fog', 0, 2, 0.1),
			range('responsive', 'Audio Reactivity', 0, 10, 0.5),
			range('cameraMovement', 'Camera Movement', 0, 5, 0.1),
			range('bpm', 'Tempo (BPM)', 1, 300, 1),
			numberControl(
				'timeOffsetInSeconds',
				'Animation phase offset (independent of audio trim)',
				0,
				86400,
				0.01,
			),
			range('inputGainDb', 'Visual gain', -30, 30, 1),
		],
	} satisfies {
		component: typeof Neuron;
		width: number;
		height: number;
		props: Partial<ComponentProps<typeof Neuron>>;
		controls: readonly Control<Extract<keyof ComponentProps<typeof Neuron>, string>>[];
	},
	matrix: {
		component: Matrix,
		width: 1280,
		height: 720,
		props: {
			color1: '#ff6b00',
			color2: '#00a8ff',
			glowColor: '#ffffff',
			textureSrc: '',
			speed: 0.5,
			scale: 1,
			iterations: 24,
			spread: 0.75,
			colorCycle: 2.5,
			glow: 1,
			responsive: 2,
			bpm: 120,
			timeOffsetInSeconds: 0,
		},
		controls: [
			color('color1', 'Primary Color'),
			color('color2', 'Secondary Color'),
			color('glowColor', 'Glow Color'),
			range('speed', 'Speed', 0.1, 2, 0.1),
			range('scale', 'Scale', 0.5, 3, 0.1),
			range('iterations', 'Iterations', 4, 24, 1),
			range('spread', 'Spread', 0.1, 1.5, 0.05),
			range('colorCycle', 'Color Cycle', 0.5, 5, 0.1),
			range('glow', 'Glow', 0, 2, 0.1),
			range('responsive', 'Audio Reactivity', 0, 10, 0.5),
			range('bpm', 'Tempo (BPM)', 1, 300, 1),
			numberControl(
				'timeOffsetInSeconds',
				'Animation phase offset (independent of audio trim)',
				0,
				86400,
				0.01,
			),
			range('inputGainDb', 'Visual gain', -30, 30, 1),
		],
	} satisfies {
		component: typeof Matrix;
		width: number;
		height: number;
		props: Partial<ComponentProps<typeof Matrix>>;
		controls: readonly Control<Extract<keyof ComponentProps<typeof Matrix>, string>>[];
	},
} as const;
