import GithubSlugger from 'github-slugger';
import {useRef, useState, type ComponentProps, type ReactElement} from 'react';
import {Link} from 'react-router';
import {highlightCode} from '../components/highlight';
import Guide, {frontmatter} from '../content/docs/getting-started.mdx';
import source from '../content/docs/getting-started.mdx?raw';
import {elementCategories, elements} from '../data/elements';
import {GITHUB, pageMeta, type PageHandle} from '../lib/site';

const {title, description} = frontmatter;

const outline = (() => {
	const slugger = new GithubSlugger();
	const body = source.replace(/^---[\s\S]*?---/, '').replace(/^```[\s\S]*?^```/gm, '');
	return [...body.matchAll(/^(#{2,3}) (.+)$/gm)].map(([, hashes, text]) => ({
		depth: hashes!.length,
		text: text!.replace(/`/g, ''),
		id: slugger.slug(text!),
	}));
})();

const CodeBlock = ({children}: ComponentProps<'pre'>) => {
	const code = children as ReactElement<{children: string; className?: string}>;
	const text = String(code.props.children).replace(/\n$/, '');
	const [label, setLabel] = useState('Copy');
	const reset = useRef(0);
	return (
		<div className="docs-code">
			<button
				type="button"
				className="docs-code-copy"
				onClick={async () => {
					try {
						await navigator.clipboard.writeText(text);
						setLabel('Copied');
					} catch {
						setLabel('Select to copy');
					}
					window.clearTimeout(reset.current);
					reset.current = window.setTimeout(() => setLabel('Copy'), 1600);
				}}
			>
				{label}
			</button>
			<pre>
				{/language-(sh|bash|shell)/.test(code.props.className ?? '') ? (
					<code>{text}</code>
				) : (
					<code dangerouslySetInnerHTML={{__html: highlightCode(text)}} />
				)}
			</pre>
		</div>
	);
};

const DocsLink = ({href = '', ...props}: ComponentProps<'a'>) =>
	href.startsWith('/') && !/\.(md|txt)$/.test(href) ? (
		<Link to={href} {...props} />
	) : (
		<a href={href} {...props} />
	);

export const handle: PageHandle = {pageClass: 'page-docs'};

export const meta = () =>
	pageMeta({title, description, path: '/getting-started', markdown: '/getting-started.md'});

export default function GettingStarted() {
	return (
		<div className="docs-layout">
			<nav className="docs-nav" aria-label="Docs">
				<p className="docs-nav-label">Docs</p>
				<Link to="/getting-started" aria-current="page">
					Getting started
				</Link>
				<Link to="/examples">Examples</Link>
				<p className="docs-nav-label">Collection</p>
				{elementCategories.map((category) => (
					<Link key={category.id} to={`/${category.id}`}>
						{category.title}
						<span>{elements.filter((entry) => entry.category === category.id).length}</span>
					</Link>
				))}
				<p className="docs-nav-label">Elsewhere</p>
				<a href={GITHUB}>GitHub</a>
				<a href="https://banger.show/">banger.show</a>
			</nav>
			<article className="docs-main">
				<header className="docs-hero">
					<h1 id="_top">{title}</h1>
					<p className="docs-lede">{description}</p>
				</header>
				<div className="docs-content">
					<Guide components={{pre: CodeBlock, a: DocsLink}} />
				</div>
			</article>
			<nav className="docs-toc" aria-labelledby="docs-toc-title">
				<h2 id="docs-toc-title">On this page</h2>
				<ul>
					<li>
						<a href="#_top">Overview</a>
					</li>
					{outline.map((heading) => (
						<li key={heading.id} data-depth={heading.depth}>
							<a href={`#${heading.id}`}>{heading.text}</a>
						</li>
					))}
				</ul>
			</nav>
		</div>
	);
}
