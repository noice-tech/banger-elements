import type {APIRoute} from 'astro';
import {indexMarkdown} from '../data/markdown';

export const GET: APIRoute = () =>
	new Response(indexMarkdown(), {headers: {'Content-Type': 'text/plain; charset=utf-8'}});
