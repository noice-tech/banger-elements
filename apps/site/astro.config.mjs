import process from 'node:process';
import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

export default defineConfig({
	output: 'static',
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
			customCss: ['./src/style.css'],
			components: {
				Footer: './src/components/Footer.astro',
				SiteTitle: './src/components/SiteTitle.astro',
				Sidebar: './src/components/Sidebar.astro',
				PageTitle: './src/components/PageTitle.astro',
			},
			sidebar: [
				{label: 'Overview', link: '/'},
				{label: 'Getting started', link: '/getting-started.html'},
				{label: 'Examples', link: '/examples.html'},
				{
					label: 'Elements',
					items: [
						{label: 'Waveform', link: '/waveform.html'},
						{label: 'Spectre', link: '/spectre.html'},
						{label: 'Oscilloscope', link: '/oscilloscope.html'},
						{label: 'Pulsar', link: '/pulsar.html'},
						{label: 'Circle', link: '/circle.html'},
						{label: 'Halo', link: '/halo.html'},
						{label: 'Ferrofluid', link: '/ferrofluid.html'},
						{label: 'Audio Particles', link: '/audio-particles.html'},
					],
				},
			],
		}),
		react(),
	],
});
