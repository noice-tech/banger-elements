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
				SocialIcons: './src/components/HeaderActions.astro',
				Footer: './src/components/Footer.astro',
				SiteTitle: './src/components/SiteTitle.astro',
				Sidebar: './src/components/Sidebar.astro',
			},
			sidebar: [
				{label: 'Getting started', link: '/getting-started.html'},
				{label: 'Examples', link: '/examples.html'},
			],
		}),
		react(),
	],
});
