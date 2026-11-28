import {Link} from 'react-router';
import {recipes} from '../components/recipes/recipes';
import {Collection} from '../components/site/Collection';
import {PlayVideo} from '../components/site/PlayVideo';
import {elements} from '../data/elements';
import {shaderDetails} from '../data/shader-updates';
import {pageMeta, type PageHandle} from '../lib/site';

const pitch =
	'Visualizers and shaders for Remotion that react to your music, plus effects to wrap them in.';
const featuredExample = recipes.find((recipe) => recipe.id === 'release-reel')!;
const otherExamples = recipes.filter((recipe) => recipe !== featuredExample);
const divisor = (a: number, b: number): number => (b === 0 ? a : divisor(b, a % b));
const shape = divisor(featuredExample.width, featuredExample.height);
const featuredRatio = `${featuredExample.width / shape}:${featuredExample.height / shape}`;
const added = ['wet-glass', ...Object.keys(shaderDetails)].map((slug) =>
	elements.find((entry) => entry.slug === slug)!,
);

export const handle: PageHandle = {pageClass: 'page-home'};

export const meta = () =>
	pageMeta({
		title: 'Banger Elements | Audio-reactive visuals for Remotion',
		description: pitch,
		path: '/',
		markdown: '/index.md',
	});

export default function Home() {
	return (
		<>
			<section className="hero" aria-labelledby="hero-title">
				<div className="wrap hero-copy">
					<h1 id="hero-title">
						Audio-reactive{' '}
						<span className="halo-word">
							<span className="halo-word-glow" aria-hidden="true">
								<PlayVideo
									muted
									loop
									playsInline
									preload="auto"
									tabIndex={-1}
									disablePictureInPicture
									onPlaying={(event) => event.currentTarget.toggleAttribute('data-playing', true)}
								>
									<source src="/hero/word.webm" type="video/webm" />
								</PlayVideo>
							</span>
							visuals
						</span>{' '}
						for Remotion.
					</h1>
					<p className="lede">
						Visualizers and shaders that react to your music, plus effects to wrap them in.
					</p>
					<div className="announce">
						<Link
							className="announce-link"
							to="/elements/wet-glass"
							aria-label={`Wet Glass and ${added.length - 1} shaders`}
						>
							<span className="deck" aria-hidden="true">
								{added.map((entry, index) => (
									<img
										key={entry.slug}
										src={`/posters/icons/${entry.slug}.webp`}
										alt=""
										width="32"
										height="18"
										decoding="async"
										style={{'--i': index} as React.CSSProperties}
									/>
								))}
							</span>
							<span className="announce-text">
								<strong>Wet Glass</strong> and {added.length - 1} shaders
							</span>
						</Link>
					</div>
				</div>
			</section>

			<section className="section" id="collection" aria-label="Elements">
				<div className="wrap">
					<Collection />
				</div>
			</section>

			<section className="section examples-teaser" aria-labelledby="examples-title">
				<div className="wrap examples-teaser-grid">
					<div className="examples-teaser-copy">
						<h2 id="examples-title" className="section-title">
							Start from a finished video.{' '}
							<span className="tone">Copy the code that rendered it.</span>
						</h2>
						<p className="lede">
							This reel is 1080 by 1920 pixels, the size Reels, Shorts and TikTok use. Swap in your
							song and captions, then render it in Remotion.
						</p>
						<Link className="examples-more" to="/examples">
							<span className="deck" aria-hidden="true">
								{otherExamples.map((recipe, index) => (
									<img
										key={recipe.id}
										src={`/recipes/icons/${recipe.id}.webp`}
										alt=""
										width="40"
										height="24"
										loading="lazy"
										decoding="async"
										style={{'--i': index} as React.CSSProperties}
									/>
								))}
							</span>
							<span className="examples-more-text">
								<strong>See {otherExamples.length} more examples</strong>
								<span>Lyric video, trailer, podcast clip and more</span>
							</span>
							<span className="examples-more-arrow" aria-hidden="true">
								→
							</span>
						</Link>
					</div>
					<Link className="example-feature" to={`/examples#${featuredExample.id}`}>
						<span
							className="example-feature-shot"
							style={
								{
									'--ratio': `${featuredExample.width} / ${featuredExample.height}`,
								} as React.CSSProperties
							}
						>
							<PlayVideo
								muted
								loop
								playsInline
								preload="none"
								poster={`/recipes/${featuredExample.id}.webp`}
								aria-hidden="true"
							>
								<source src={`/recipes/${featuredExample.id}.webm`} type="video/webm" />
							</PlayVideo>
						</span>
						<span className="example-feature-title">{featuredExample.title}</span>
						<span className="example-feature-use">
							{featuredExample.use} · {featuredRatio}
						</span>
					</Link>
				</div>
			</section>
		</>
	);
}
