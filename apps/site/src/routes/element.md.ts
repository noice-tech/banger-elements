import {elementMarkdown} from '../data/markdown';
import {elements} from '../data/elements';
import type {Route} from './+types/element.md';

export const loader = ({params}: Route.LoaderArgs) => {
	const element = elements.find((entry) => entry.slug === params.slug);
	if (!element) return new Response('Not found', {status: 404});
	return new Response(elementMarkdown(element), {
		headers: {'Content-Type': 'text/markdown; charset=utf-8'},
	});
};
