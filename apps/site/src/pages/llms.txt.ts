import type {APIRoute} from 'astro';
import {indexMarkdown} from '../data/markdown';

// The Markdown index of the collection, read by coding agents and Remotion's
// /remotion-elements skill.
export const GET: APIRoute = () =>
	new Response(indexMarkdown(), {headers: {'Content-Type': 'text/plain; charset=utf-8'}});
