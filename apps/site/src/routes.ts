import {index, layout, route, type RouteConfig} from '@react-router/dev/routes';
import {elementCategories} from './data/elements';

export default [
	route('index.md', 'routes/index.md.ts'),
	route('llms.txt', 'routes/llms.txt.ts'),
	route('getting-started.md', 'routes/getting-started.md.ts'),
	route('elements/:slug.md', 'routes/element.md.ts'),
	route(':category.md', 'routes/category.md.ts'),
	layout('routes/layout.tsx', [
		index('routes/home.tsx'),
		...elementCategories.map(({id}) => route(id, 'routes/category.tsx', {id: `category-${id}`})),
		route('elements/:slug', 'routes/element.tsx'),
		route('examples', 'routes/examples.tsx'),
		route('getting-started', 'routes/getting-started.tsx'),
		route('404', 'routes/not-found.tsx', {id: 'not-found-page'}),
		route('*', 'routes/not-found.tsx'),
	]),
] satisfies RouteConfig;
