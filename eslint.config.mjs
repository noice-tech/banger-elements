import {config as remotionConfig} from '@remotion/eslint-config-flat';
import globals from 'globals';

export default [
	{
		ignores: ['**/dist/**', '**/.turbo/**', '**/.astro/**', 'out/**', 'public/**'],
	},
	...remotionConfig,
	{
		files: [
			'**/scripts/**/*.{js,mjs,ts,tsx}',
			'**/tests/**/*.{js,mjs,ts,tsx}',
			'scripts/*.{js,mjs,ts,tsx}',
		],
		languageOptions: {globals: globals.node},
	},
	{
		files: ['packages/elements/src/elements/**/*.tsx'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['./*', '../*', '@banger-elements/*'],
							message: 'Canonical Elements must remain standalone and use external imports only.',
						},
					],
				},
			],
		},
	},
];
