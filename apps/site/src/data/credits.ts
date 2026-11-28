export type CreditSource = {
	readonly work?: string;
	readonly author: string;
	readonly url: string;
};

export type Credit = {
	readonly original: CreditSource;
	readonly includes?: readonly CreditSource[];
};

const shadertoy = (id: string) => `https://www.shadertoy.com/view/${id}`;

export const credits: Partial<Record<string, Credit>> = {
	trip: {original: {work: 'MONSTER', author: 'butadiene', url: shadertoy('WtKSzt')}},
	space: {
		original: {
			work: 'Star Nest',
			author: 'Pablo Roman Andrioli (Kali)',
			url: shadertoy('XlfGRj'),
		},
	},
	synthwave: {original: {author: 'mrange', url: shadertoy('ddcGW8')}},
	mushrooms: {
		original: {work: '2d and 3d colorful paint', author: 'nayk', url: shadertoy('ctGfDG')},
	},
	fractals: {
		original: {
			work: 'Shader Art Coding Introduction',
			author: 'kishimisu',
			url: shadertoy('mtyGWy'),
		},
	},
	hyperloop: {
		original: {
			work: 'Hyperspace Tunnel, Simplex Noise',
			author: 'blue_max',
			url: shadertoy('4t2GzV'),
		},
	},
	downfall: {original: {work: 'Fractal Flythrough', author: 'Shane', url: shadertoy('4s3SRN')}},
	rail: {
		original: {work: 'Fractal Cartoon', author: 'Kali', url: shadertoy('XsBXWt')},
		includes: [{work: 'Nyan Cat', author: 'mu6k', url: shadertoy('4dXGWH')}],
	},
	rain: {
		original: {
			work: 'Heartfelt',
			author: 'Martijn Steinrucken (BigWings)',
			url: shadertoy('ltffzl'),
		},
	},
	kaleidoscope: {
		original: {work: 'Kaleidoscope Illusion', author: 'tiff', url: shadertoy('llGcRK')},
	},
	eye: {
		original: {
			work: 'Moving without travelling',
			author: 'mrange',
			url: shadertoy('NtXSzl'),
		},
	},
	flowers: {
		original: {work: 'Mandala flowers', author: 'mrange', url: shadertoy('NlcSRB')},
	},
	moon: {
		original: {work: 'Neonwave sunrise', author: 'mrange', url: shadertoy('7dyyRy')},
	},
	city: {
		original: {
			work: 'Neon city for Windows Terminal',
			author: 'mrange',
			url: shadertoy('csSSWc'),
		},
	},
};
