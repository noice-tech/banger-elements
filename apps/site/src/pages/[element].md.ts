import type {APIRoute, GetStaticPaths} from 'astro';
import {elementCategories, elements} from '../data/elements';
import {categoryMarkdown, elementMarkdown} from '../data/markdown';

export const getStaticPaths = (() => [
	...elements.map((element) => ({params: {element: element.slug}})),
	...elementCategories.map((category) => ({params: {element: category.id}})),
]) satisfies GetStaticPaths;

export const GET: APIRoute = ({params}) => {
	const element = elements.find((entry) => entry.slug === params.element);
	const markdown = element ? elementMarkdown(element) : categoryMarkdown(params.element!);
	return new Response(markdown, {headers: {'Content-Type': 'text/markdown; charset=utf-8'}});
};
