import type {ReactNode} from 'react';
import {Links, Meta, Outlet, Scripts, ScrollRestoration, useMatches} from 'react-router';
import type {PageHandle} from './lib/site';
import './styles/tokens.css';
import './styles/components.css';
import './styles/showcase.css';
import './styles/docs.css';

const studioMode = `if (new URLSearchParams(location.search).get('remotion-studio') === 'true' || window.parent !== window) {
	document.documentElement.dataset.studio = '';
	document.addEventListener('click', (event) => {
		const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
		if (link instanceof HTMLAnchorElement && link.origin !== location.origin) {
			link.target = '_blank';
			link.rel = 'noreferrer';
		}
	}, true);
}`;

export function Layout({children}: {children: ReactNode}) {
	const pageClass = useMatches()
		.map((match) => (match.handle as PageHandle | undefined)?.pageClass)
		.filter(Boolean)
		.at(-1);
	return (
		<html lang="en" data-theme="dark">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<script dangerouslySetInnerHTML={{__html: studioMode}} />
				<meta name="color-scheme" content="dark" />
				<meta name="theme-color" content="#07080c" />
				<link rel="icon" href="/brand/banger-icon.png" type="image/png" />
				<link rel="sitemap" href="/sitemap.xml" />
				<link rel="preload" href="/fonts/Geist.woff2" as="font" type="font/woff2" crossOrigin="" />
				<Meta />
				<Links />
			</head>
			<body className={['showcase', pageClass].filter(Boolean).join(' ')}>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function Root() {
	return <Outlet />;
}

export function HydrateFallback() {
	return null;
}
