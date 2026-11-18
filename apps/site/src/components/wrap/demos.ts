// The page and render script share this data without importing the elements.
export const WRAP_FPS = 30;
export const WRAP_FRAMES = 180;
export const WRAP_WIDTH = 1280;
export const WRAP_HEIGHT = 720;

export type WrapEffect = 'wet-glass' | 'vhs' | 'fisheye';

export type WrapDemo = {
	readonly slug: WrapEffect;
	readonly inside: string;
	/** The effect's props, as the render and the snippet use them. */
	readonly props: Readonly<Record<string, number>>;
	/** The components inside, as the snippet names them. */
	readonly children: readonly string[];
};

export const wrapDemos: readonly WrapDemo[] = [
	{
		slug: 'wet-glass',
		inside: 'city lights in plain CSS',
		props: {amount: 0.7},
		children: ['CityLights'],
	},
	{
		slug: 'vhs',
		inside: 'test bars and a running timecode',
		props: {strength: 0.85},
		children: ['ColorBars', 'Timecode'],
	},
	{
		slug: 'fisheye',
		inside: 'scrolling type',
		props: {strength: 1.2, perspectiveFactor: 0.3},
		children: ['Marquee'],
	},
];
