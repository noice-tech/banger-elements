import type {Config} from '@react-router/dev/config';
import {elementCategories, elements} from './src/data/elements';

export default {
	appDirectory: 'src',
	buildDirectory: 'build',
	ssr: false,
	prerender: [
		'/',
		'/404',
		'/examples',
		'/getting-started',
		'/getting-started.md',
		'/index.md',
		'/llms.txt',
		...elementCategories.flatMap(({id}) => [`/${id}`, `/${id}.md`]),
		...elements.flatMap(({slug}) => [`/elements/${slug}`, `/elements/${slug}.md`]),
	],
} satisfies Config;
