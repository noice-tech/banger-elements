import {useLocation, type MetaArgs} from 'react-router';
import {Collection} from '../components/site/Collection';
import {elementCategories} from '../data/elements';
import {pageMeta, type PageHandle} from '../lib/site';

const categoryAt = (pathname: string) =>
	elementCategories.find(({id}) => pathname.replace(/\/$/, '') === `/${id}`)!;

export const handle: PageHandle = {pageClass: 'page-category'};

export const meta = ({location}: MetaArgs) => {
	const category = categoryAt(location.pathname);
	return pageMeta({
		title: `${category.title} for Remotion`,
		description: `${category.description} Open one to play it and change its settings, then add it to Remotion Studio.`,
		path: `/${category.id}`,
		image: `/share/${category.id}.jpg`,
		imageAlt: `A grid of Banger Elements ${category.title.toLowerCase()}`,
		markdown: `/${category.id}.md`,
	});
};

export default function CategoryPage() {
	const category = categoryAt(useLocation().pathname);
	return (
		<div className="wrap">
			<header className="page-hero">
				<h1>
					{category.title} <span className="tone">for Remotion.</span>
				</h1>
				<p className="lede">{category.description} Open one to play it and change its settings.</p>
			</header>
			<Collection category={category.id} />
		</div>
	);
}
