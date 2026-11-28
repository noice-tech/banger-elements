import {useEffect, useRef} from 'react';
import {useLocation} from 'react-router';
import {GITHUB} from '../../lib/site';
import {ClientOnly} from '../ClientOnly';
import StudioActions from '../StudioActions';
import {Brand} from './Brand';
import {GitHubIcon} from './GitHubIcon';
import {SiteNav} from './SiteNav';

export const SiteHeader = () => {
	const menu = useRef<HTMLDetailsElement>(null);
	const {pathname} = useLocation();
	useEffect(() => {
		if (menu.current) menu.current.open = false;
	}, [pathname]);
	useEffect(() => {
		const close = (event: MouseEvent) => {
			if (menu.current?.open && !menu.current.contains(event.target as Node))
				menu.current.open = false;
		};
		document.addEventListener('click', close);
		return () => document.removeEventListener('click', close);
	}, []);
	return (
		<header className="site-header">
			<div className="site-header-inner">
				<Brand />
				<SiteNav className="site-nav" label="Main" />
				<div className="site-header-end">
					<a className="parent-link" href="https://banger.show/">
						banger.show
						<svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
							<path
								d="M3.5 8.5l5-5M4.5 3.5h4v4"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.4"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</a>
					<a className="icon-link" href={GITHUB} aria-label="Banger Elements on GitHub">
						<GitHubIcon />
					</a>
					<div className="header-studio">
						<ClientOnly>{() => <StudioActions />}</ClientOnly>
					</div>
					<details className="mobile-menu" ref={menu}>
						<summary aria-label="Menu">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.6"
								aria-hidden="true"
							>
								<path d="M4 8h16M4 16h16" />
							</svg>
						</summary>
						<SiteNav className="mobile-menu-panel" label="Mobile">
							<a href={GITHUB}>GitHub</a>
							<a href="https://banger.show/">banger.show</a>
						</SiteNav>
					</details>
				</div>
			</div>
		</header>
	);
};
