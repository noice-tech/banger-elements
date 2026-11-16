import process from 'node:process';
import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

export default defineConfig({
	output: 'static',
	site: 'https://banger-elements.dev',
	server: {host: '127.0.0.1', port: Number(process.env.PORT ?? 3300)},
	publicDir: './static',
	build: {format: 'file'},
	trailingSlash: 'never',
	integrations: [
		starlight({
			title: 'Banger Elements',
			description: 'Source-installable audio visualizers for Remotion.',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/noice-tech/banger-elements',
				},
			],
			favicon: '/brand/banger-icon.png',
			customCss: [
				'./src/styles/tokens.css',
				'./src/styles/components.css',
				'./src/styles/docs.css',
			],
			components: {
				Header: './src/components/docs/DocsHeader.astro',
				PageTitle: './src/components/docs/DocsPageTitle.astro',
				ThemeProvider: './src/components/docs/DarkTheme.astro',
				ThemeSelect: './src/components/docs/Empty.astro',
				Footer: './src/components/Footer.astro',
				Sidebar: './src/components/Sidebar.astro',
			},
			expressiveCode: {
				themes: ['github-dark-default'],
				styleOverrides: {
					borderRadius: '14px',
					borderColor: 'var(--line)',
					codeBackground: 'var(--bg-raised)',
					codeFontFamily: 'var(--font-mono)',
					codeFontSize: '0.82rem',
					codeLineHeight: '1.75',
					uiFontFamily: 'var(--font-sans)',
					frames: {
						editorTabBarBackground: 'var(--bg-raised)',
						editorActiveTabBackground: 'var(--bg-raised)',
						editorActiveTabIndicatorTopColor: 'transparent',
						editorActiveTabIndicatorBottomColor: 'var(--accent-hi)',
						editorTabBarBorderBottomColor: 'var(--line)',
						terminalTitlebarBackground: 'var(--bg-raised)',
						terminalTitlebarBorderBottomColor: 'var(--line)',
						terminalBackground: 'var(--bg-raised)',
						frameBoxShadowCssValue: 'none',
						inlineButtonBorder: 'var(--line-strong)',
						tooltipSuccessBackground: 'var(--accent)',
					},
				},
			},
			sidebar: [
				{label: 'Getting started', link: '/getting-started.html'},
				{label: 'Examples', link: '/examples.html'},
			],
		}),
		react(),
	],
});
