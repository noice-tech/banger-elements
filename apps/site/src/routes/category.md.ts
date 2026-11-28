import {data} from 'react-router';
import {elementCategories} from '../data/elements';
import {categoryMarkdown} from '../data/markdown';
import type {Route} from './+types/category.md';

export const loader = ({params}: Route.LoaderArgs) => {
	if (!elementCategories.some(({id}) => id === params.category))
		throw data('Not found', {status: 404});
	return new Response(categoryMarkdown(params.category), {
		headers: {'Content-Type': 'text/markdown; charset=utf-8'},
	});
};
