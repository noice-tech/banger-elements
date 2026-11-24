// The package entry declares Starlight's `locals.starlightRoute` type.
import type {} from '@astrojs/starlight';
import {defineRouteMiddleware} from '@astrojs/starlight/route-data';

const SITE = 'https://banger-elements.dev';
// Docs with a Markdown twin in src/pages; other docs routes (such as 404) point at llms.txt.
const MARKDOWN_TWINS = new Set(['getting-started']);

// Docs pages: match the showcase pages' extensionless URLs, share image and Markdown twin.
export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	const clean = (url: string) => url.replace(/(index)?\.html$/, '');
	for (const tag of route.head) {
		if (tag.tag === 'link' && tag.attrs?.rel === 'canonical' && typeof tag.attrs.href === 'string')
			tag.attrs.href = clean(tag.attrs.href);
		if (
			tag.tag === 'meta' &&
			tag.attrs?.property === 'og:url' &&
			typeof tag.attrs.content === 'string'
		)
			tag.attrs.content = clean(tag.attrs.content);
	}
	const image = `${SITE}/share/site.jpg`;
	const alt = 'A grid of Banger Elements visualizers, shaders and effects';
	route.head.push(
		{tag: 'meta', attrs: {property: 'og:image', content: image}},
		{tag: 'meta', attrs: {property: 'og:image:type', content: 'image/jpeg'}},
		{tag: 'meta', attrs: {property: 'og:image:width', content: '1200'}},
		{tag: 'meta', attrs: {property: 'og:image:height', content: '630'}},
		{tag: 'meta', attrs: {property: 'og:image:alt', content: alt}},
		{tag: 'meta', attrs: {name: 'twitter:image', content: image}},
		{tag: 'meta', attrs: {name: 'twitter:image:alt', content: alt}},
		{
			tag: 'link',
			attrs: {
				rel: 'alternate',
				type: 'text/markdown',
				href: MARKDOWN_TWINS.has(route.id) ? `/${route.id}.md` : '/llms.txt',
				title: 'Markdown for coding agents',
			},
		},
	);
});
