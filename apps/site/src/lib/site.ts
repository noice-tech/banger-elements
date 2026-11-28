import type {MetaDescriptor} from 'react-router';

export const SITE = 'https://banger-elements.dev';
const SITE_NAME = 'Banger Elements';
export const GITHUB = 'https://github.com/noice-tech/banger-elements';

export const elementPath = (slug: string) => `/elements/${slug}`;

export const pageMeta = ({
	title,
	description,
	path,
	image = '/share/site.jpg',
	imageAlt = 'A grid of Banger Elements visualizers, shaders and effects',
	markdown = '/llms.txt',
	payload,
}: {
	title: string;
	description: string;
	path: string;
	image?: string;
	imageAlt?: string;
	markdown?: string;
	payload?: string;
}): MetaDescriptor[] => {
	const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
	const canonical = new URL(path, SITE).href;
	const imageUrl = new URL(image, SITE).href;
	return [
		{title: fullTitle},
		{name: 'description', content: description},
		{tagName: 'link', rel: 'canonical', href: canonical},
		{property: 'og:type', content: 'website'},
		{property: 'og:title', content: fullTitle},
		{property: 'og:description', content: description},
		{property: 'og:url', content: canonical},
		{property: 'og:site_name', content: SITE_NAME},
		{property: 'og:image', content: imageUrl},
		{property: 'og:image:type', content: 'image/jpeg'},
		{property: 'og:image:width', content: '1200'},
		{property: 'og:image:height', content: '630'},
		{property: 'og:image:alt', content: imageAlt},
		{name: 'twitter:card', content: 'summary_large_image'},
		{name: 'twitter:image', content: imageUrl},
		{name: 'twitter:image:alt', content: imageAlt},
		{
			tagName: 'link',
			rel: 'alternate',
			type: 'text/markdown',
			href: markdown,
			title: 'Markdown for coding agents',
		},
		...(payload
			? [
					{
						tagName: 'link',
						rel: 'alternate',
						type: 'application/vnd.remotion.element+json',
						href: payload,
					} satisfies MetaDescriptor,
				]
			: []),
	];
};

/** Per-route page settings that the root layout reads with `useMatches()`. */
export type PageHandle = {pageClass: string};
