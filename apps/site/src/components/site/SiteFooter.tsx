import {Link} from 'react-router';
import packageMetadata from '../../../package.json';
import {elementCategories} from '../../data/elements';
import {GITHUB} from '../../lib/site';
import {Brand} from './Brand';

export const SiteFooter = () => (
	<footer className="site-foot">
		<div className="site-foot-inner">
			<div className="site-foot-brand">
				<Brand />
				<p>
					Visualizers and shaders for Remotion that react to your music, plus effects to wrap them
					in.
				</p>
			</div>
			<nav className="site-foot-links" aria-label="Footer">
				<div>
					<p>Collection</p>
					{elementCategories.map((category) => (
						<Link key={category.id} to={`/${category.id}`}>
							{category.title}
						</Link>
					))}
				</div>
				<div>
					<p>Docs</p>
					<Link to="/getting-started">Getting started</Link>
					<Link to="/examples">Examples</Link>
					<Link to="/getting-started#audio-setup">Audio setup</Link>
					<a href="/llms.txt">llms.txt for agents</a>
				</div>
				<div>
					<p>Elsewhere</p>
					<a href={GITHUB}>GitHub</a>
					<a href="https://banger.show/">banger.show</a>
					<a href="https://www.remotion.dev/">Remotion</a>
				</div>
			</nav>
		</div>
		<div className="site-foot-base">
			<span>v{packageMetadata.version} · MIT licensed</span>
			<span>
				Made by <a href="https://noice.tech/">noice.tech</a>
			</span>
		</div>
	</footer>
);
