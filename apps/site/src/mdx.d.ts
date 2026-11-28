declare module '*.mdx' {
	import type {MDXProps} from 'mdx/types';
	import type {JSX} from 'react';

	export const frontmatter: {title: string; description: string};
	export default function MDXContent(props: MDXProps): JSX.Element;
}
