import {useRef, useState} from 'react';
import {Link} from 'react-router';
import {highlightLine} from '../components/highlight';
import episodeClip from '../components/recipes/episode-clip.tsx?raw';
import lyricVideo from '../components/recipes/lyric-video.tsx?raw';
import musicVisualizer from '../components/recipes/music-visualizer.tsx?raw';
import rainyStream from '../components/recipes/rainy-stream.tsx?raw';
import {DEMO_SONG, RECIPE_FPS, recipes} from '../components/recipes/recipes';
import releaseReel from '../components/recipes/release-reel.tsx?raw';
import releaseTeaser from '../components/recipes/release-teaser.tsx?raw';
import verticalCanvas from '../components/recipes/vertical-canvas.tsx?raw';
import {PlayVideo} from '../components/site/PlayVideo';
import {elements} from '../data/elements';
import {elementPath, pageMeta, type PageHandle} from '../lib/site';

const sources: Record<string, string> = {
	'episode-clip': episodeClip,
	'lyric-video': lyricVideo,
	'music-visualizer': musicVisualizer,
	'release-teaser': releaseTeaser,
	'release-reel': releaseReel,
	'vertical-canvas': verticalCanvas,
	'rainy-stream': rainyStream,
};
const element = (slug: string) => elements.find((entry) => entry.slug === slug)!;
const byName = new Map(elements.map((entry) => [entry.name, entry.slug]));

const forReaders = (source: string) =>
	source.replace(
		/^import \{([^}]+)\} from '[^']*packages\/elements\/dist\/components';$/m,
		(_, names: string) =>
			names
				.split(',')
				.map((name) => name.trim())
				.map((name) => `import {${name}} from './${byName.get(name)}.element';`)
				.join('\n'),
	);

const shapeOf = (width: number, height: number) => {
	if (width === height) return 'square';
	return width > height ? 'wide' : 'tall';
};

const cards = recipes.map((recipe) => {
	const code = forReaders(sources[recipe.id]!).trimEnd();
	const scale = recipe.outputScale ?? 1;
	const seconds = recipe.durationInFrames / RECIPE_FPS;
	const flags = [
		'--gl=angle',
		...(scale === 1 ? [] : [`--scale=${scale}`]),
		...(recipe.silent ? ['--codec=h264', '--muted'] : []),
	];
	return {
		...recipe,
		code,
		shape: shapeOf(recipe.width, recipe.height),
		format: `${recipe.width * scale} × ${recipe.height * scale}`,
		length: `${Number(seconds.toFixed(1))} s`,
		command: `npx remotion render ${recipe.component} ${flags.join(' ')}`,
		audio: `/${recipe.audioFile ?? DEMO_SONG}`,
		lines: code.split('\n').map(highlightLine),
		layerEntries: recipe.layers.map(element),
	};
});

export const handle: PageHandle = {pageClass: 'page-examples'};

export const meta = () =>
	pageMeta({
		title: 'Examples',
		description:
			'Seven Remotion compositions made with Banger Elements: a lyric video, a music visualizer, a release trailer, a work-in-progress reel, a Spotify Canvas, a podcast clip and a lo-fi stream background. Each one comes with the code that rendered it.',
		path: '/examples',
	});

const CopyButton = ({code}: {code: string}) => {
	const [label, setLabel] = useState('Copy code');
	const reset = useRef(0);
	return (
		<button
			type="button"
			className="code-copy"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(code);
					setLabel('Copied');
				} catch {
					setLabel('Select to copy');
				}
				window.clearTimeout(reset.current);
				reset.current = window.setTimeout(() => setLabel('Copy code'), 1600);
			}}
		>
			{label}
		</button>
	);
};

export default function Examples() {
	const players = useRef(new Set<HTMLVideoElement>());
	const keepOneVoice = (video: HTMLVideoElement) => {
		if (video.muted) return;
		for (const other of players.current) if (other !== video) other.muted = true;
	};
	return (
		<div className="wrap">
			<header className="page-hero">
				<h1>
					Built from <span className="tone">the collection.</span>
				</h1>
				<p className="lede">
					Each of these seven Remotion compositions matches the size its platform expects. Under
					each clip is the file that rendered it. Replace the audio and the text, then render your
					own.
				</p>
			</header>

			<nav className="recipe-index" aria-label="Examples on this page">
				{cards.map((card) => (
					<a key={card.id} href={`#${card.id}`}>
						<img src={`/recipes/${card.id}.webp`} alt="" loading="lazy" decoding="async" />
						<span>{card.title}</span>
					</a>
				))}
			</nav>

			{cards.map((card) => (
				<article
					key={card.id}
					className="recipe"
					id={card.id}
					data-shape={card.shape}
					aria-labelledby={`${card.id}-title`}
				>
					<div
						className="recipe-player"
						style={{'--ratio': `${card.width} / ${card.height}`} as React.CSSProperties}
					>
						<PlayVideo
							ref={(video: HTMLVideoElement | null) => {
								if (video) players.current.add(video);
							}}
							className="recipe-screen"
							controls
							muted
							loop
							playsInline
							preload="none"
							poster={`/recipes/${card.id}.webp`}
							aria-label={`${card.title} video`}
							onVolumeChange={(event) => keepOneVoice(event.currentTarget)}
						>
							<source src={`/recipes/${card.id}.webm`} type="video/webm" />
						</PlayVideo>
					</div>
					<div className="recipe-body">
						<p className="recipe-use">{card.use}</p>
						<h2 id={`${card.id}-title`}>{card.title}</h2>
						<p className="recipe-description">{card.description}</p>
						<p className="recipe-facts">
							<span>{card.format}</span>
							<span>{card.length}</span>
							<span>{RECIPE_FPS} fps</span>
						</p>
						<p className="recipe-layers-label">Layers, back to front</p>
						<ol className="recipe-layers">
							{card.layerEntries.map((entry) => (
								<li key={entry.slug}>
									<Link to={elementPath(entry.slug)}>
										<img
											src={`/posters/${entry.slug}.webp`}
											alt=""
											loading="lazy"
											decoding="async"
										/>
										{entry.title}
									</Link>
								</li>
							))}
						</ol>
						{card.audioCredit && (
							<p className="recipe-credit">
								Music: <a href={card.audioCredit.source}>{card.audioCredit.title}</a> by{' '}
								{card.audioCredit.artist},{' '}
								<a href={card.audioCredit.licenseUrl}>{card.audioCredit.license}</a>
							</p>
						)}
					</div>
					<details className="recipe-code code-window">
						<summary className="code-window-bar">
							<span className="code-file">
								<span className="code-dir">src/</span>
								{card.component}.tsx
							</span>
							<span className="recipe-code-meta">
								<span className="recipe-code-count">{card.lines.length} lines</span>
								<span className="recipe-code-toggle" aria-hidden="true"></span>
							</span>
						</summary>
						<div className="recipe-code-actions">
							<code>
								<span aria-hidden="true">$ </span>
								{card.command}
							</code>
							<span className="recipe-code-buttons">
								<a className="code-copy" href={card.audio} download>
									Download audio
								</a>
								<CopyButton code={card.code} />
							</span>
						</div>
						<pre className="code-lines">
							<code>
								{card.lines.map((html, index) => (
									<span key={index} className="line" dangerouslySetInnerHTML={{__html: html}} />
								))}
							</code>
						</pre>
					</details>
				</article>
			))}
		</div>
	);
}
