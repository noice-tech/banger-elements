import {Outlet} from 'react-router';
import {SiteFooter} from '../components/site/SiteFooter';
import {SiteHeader} from '../components/site/SiteHeader';

export default function SiteLayout() {
	return (
		<>
			<a className="skip-link" href="#main">
				Skip to content
			</a>
			<SiteHeader />
			<main id="main">
				<Outlet />
			</main>
			<SiteFooter />
		</>
	);
}
