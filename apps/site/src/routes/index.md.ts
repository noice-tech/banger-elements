import {indexMarkdown} from '../data/markdown';

export const loader = () =>
	new Response(indexMarkdown(), {headers: {'Content-Type': 'text/markdown; charset=utf-8'}});
