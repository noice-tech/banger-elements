import {Link} from 'react-router';
import {pageMeta, type PageHandle} from '../lib/site';

export const handle: PageHandle = {pageClass: 'page-category'};

export const meta = () =>
	pageMeta({
		title: 'Page not found',
		description: 'This page does not exist. Browse the Banger Elements collection instead.',
		path: '/404',
	});

export default function NotFound() {
	return (
		<div className="wrap">
			<header className="page-hero">
				<h1>
					Page not found. <span className="tone">Try the collection.</span>
				</h1>
				<p className="lede">The page you asked for does not exist or has moved.</p>
				<p>
					<Link className="button" to="/">
						Browse elements
					</Link>
				</p>
			</header>
		</div>
	);
}
