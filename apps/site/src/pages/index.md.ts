import type {APIRoute} from 'astro';
import {indexMarkdown} from '../data/markdown';

export const GET: APIRoute = () =>
	new Response(indexMarkdown(), {headers: {'Content-Type': 'text/markdown; charset=utf-8'}});
