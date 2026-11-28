import type {ReactNode} from 'react';
import {Link, useLocation} from 'react-router';
import {elementCategories, elements} from '../../data/elements';
import {elementPath} from '../../lib/site';

export const SiteNav = ({
	className,
	label,
	children,
}: {
	className: string;
	label: string;
	children?: ReactNode;
}) => {
	const current = useLocation().pathname.replace(/\/$/, '') || '/';
	const activeCategory =
		elementCategories.find((category) => current === `/${category.id}`)?.id ??
		elements.find((entry) => current === elementPath(entry.slug))?.category;
	const links = [
		...elementCategories.map((category) => ({
			href: `/${category.id}`,
			label: category.title,
			active: activeCategory === category.id,
		})),
		{href: '/examples', label: 'Examples', active: current === '/examples'},
		{href: '/getting-started', label: 'Docs', active: current === '/getting-started'},
	];
	return (
		<nav className={className} aria-label={label}>
			{links.map((link) => (
				<Link key={link.href} to={link.href} aria-current={link.active ? 'page' : undefined}>
					{link.label}
				</Link>
			))}
			{children}
		</nav>
	);
};
