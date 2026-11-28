import {lazy, Suspense} from 'react';
import {Link, data, useLoaderData, type MetaArgs} from 'react-router';
import {ClientOnly} from '../components/ClientOnly';
import {highlightCode} from '../components/highlight';
import type {PreviewKind} from '../components/preview/examples';
import {GitHubIcon} from '../components/site/GitHubIcon';
import {useHoverPlay} from '../components/site/media';
import {
	elementPayloadHtml,
	elementPayloadMimeType,
	elementTextureFile,
} from '../data/element-payloads';
import type {Credit, CreditSource} from '../data/credits';
import {elementCategories, elements} from '../data/elements';
import {GITHUB, elementPath, pageMeta, type PageHandle} from '../lib/site';
import type {Route} from './+types/element';

const Preview = lazy(() => import('../components/Preview'));

const entryFor = (slug: string | undefined) => elements.find((entry) => entry.slug === slug);

export const loader = ({params}: Route.LoaderArgs) => {
	const entry = entryFor(params.slug);
	if (!entry) throw data('Element not found', {status: 404});
	return {payloadHtml: elementPayloadHtml(entry.slug), texture: elementTextureFile(entry.slug)};
};

export const handle: PageHandle = {pageClass: 'page-element'};

export const meta = ({params}: MetaArgs) => {
	const entry = entryFor(params.slug);
	if (!entry) return [{title: 'Element not found | Banger Elements'}];
	return pageMeta({
		title: entry.title,
		description: entry.description,
		path: elementPath(entry.slug),
		image: `/share/${entry.slug}.jpg`,
		imageAlt: `${entry.title}: ${entry.tagline}`,
		markdown: `${elementPath(entry.slug)}.md`,
		payload: `/elements/${entry.slug}.json`,
	});
};

const NextCard = ({next}: {next: (typeof elements)[number]}) => {
	const {video, hoverProps} = useHoverPlay();
	return (
		<Link className="next-card" to={elementPath(next.slug)} {...hoverProps}>
			<video
				ref={video}
				muted
				loop
				playsInline
				preload="none"
				poster={`/posters/${next.slug}.webp`}
				aria-hidden="true"
			>
				<source src={`/previews/${next.slug}.webm`} type="video/webm" />
			</video>
			<span className="tile-shade" aria-hidden="true"></span>
			<span className="next-copy">
				<span className="kicker" id="next-title">
					Up next
				</span>
				<span className="next-title">
					{next.title} <span aria-hidden="true">→</span>
				</span>
				<span className="next-tagline">{next.tagline}</span>
			</span>
		</Link>
	);
};

const SourceLink = ({source}: {source: CreditSource}) => (
	<>
		<a href={source.url} target="_blank" rel="noreferrer">
			{source.work ? `"${source.work}"` : 'a shader'}
		</a>
		, © {source.author}
	</>
);

const Credits = ({credit}: {credit: Credit}) => (
	<p className="element-credit">
		Remixed from <SourceLink source={credit.original} />.
		{credit.includes?.map((source) => (
			<span key={source.url}>
				{' '}
				Also uses <SourceLink source={source} />.
			</span>
		))}
	</p>
);

export default function ElementPage({params}: Route.ComponentProps) {
	const {payloadHtml, texture} = useLoaderData<typeof loader>();
	const entry = entryFor(params.slug)!;
	const isWrapper = entry.category === 'effects';
	const wrapperName = entry.name;
	const bypassKey = entry.slug === 'wet-glass' ? 'amount' : 'strength';
	const bypassValues: Record<string, number> = {'wet-glass': 0.65, vhs: 1};
	const wrapperExample = `import {${wrapperName}} from './${entry.slug}.element';
import {Space} from './space.element';
import {Halo} from './halo.element';

// Install Space and Halo separately, or use your existing content.
<${wrapperName} width={1280} height={720} ${bypassKey}={${bypassValues[entry.slug] ?? 0.75}}>
  <Space playAudio={false} style={{position: 'absolute', inset: 0}} />
  <Halo playAudio style={{position: 'absolute', inset: 0}} />
</${wrapperName}>`;
	const category = elementCategories.find(({id}) => id === entry.category)!;
	const featured: readonly string[] = category.featured;
	const rank = (slug: string) =>
		featured.includes(slug) ? featured.indexOf(slug) : featured.length;
	const siblings = elements
		.filter((element) => element.category === entry.category)
		.sort((a, b) => rank(a.slug) - rank(b.slug));
	const position = siblings.findIndex((element) => element.slug === entry.slug);
	const next =
		siblings.length > 1
			? siblings[(position + 1) % siblings.length]!
			: elements.find((element) => element.slug !== entry.slug)!;
	const fallback = (
		<div className="preview-block">
			<div className="preview-stage">
				<div className="preview-placeholder" role="status" aria-label="Loading preview"></div>
			</div>
		</div>
	);

	return (
		<>
			<div className="wrap wrap-wide">
				<header className="element-head">
					<h1 id="_top">{entry.title}</h1>
					<p className="element-tagline">{entry.tagline}</p>
				</header>
				<div className="element-workbench">
					<div className="element-preview">
						<ClientOnly fallback={fallback}>
							{() => (
								<Suspense fallback={fallback}>
									<Preview
										key={entry.slug}
										slug={entry.slug as PreviewKind}
										editable
										installTargetId={`${entry.slug}-studio-actions`}
										controlsTargetId={`${entry.slug}-preview-controls`}
									/>
								</Suspense>
							)}
						</ClientOnly>
						<section className="preview-install" aria-label={`${entry.title} installation`}>
							<script
								type={elementPayloadMimeType}
								dangerouslySetInnerHTML={{__html: payloadHtml}}
							/>
							<div id={`${entry.slug}-studio-actions`}></div>
							<div className="source-links">
								<a href={`/elements/${entry.slug}.tsx`} download={`${entry.slug}.element.tsx`}>
									Download TSX <span aria-hidden="true">↓</span>
								</a>
								<a
									href={`${GITHUB}/blob/main/packages/elements/src/elements/${entry.slug}/${entry.slug}.tsx`}
									target="_blank"
									rel="noreferrer"
								>
									<GitHubIcon /> Source
								</a>
							</div>
							<p className="install-note">
								{isWrapper
									? `Installs the wrapper only, not the demo. After confirming in Studio, move your existing JSX inside <${wrapperName}> in code. Inserting it as a sibling does not apply the effect.`
									: 'Install or drag to use your preview settings. Confirm the request in Studio.'}
							</p>
							<details className="install-help">
								<summary>Need help connecting?</summary>
								<p>
									Open a composition in a compatible Remotion Studio first. Install and drag both
									require confirmation. On touch devices, use Install in Studio. You can also{' '}
									<Link to="/getting-started#install-from-the-command-line">
										install from the command line
									</Link>
									.
								</p>
							</details>
							{entry.credit && <Credits credit={entry.credit} />}
						</section>
					</div>
					<aside className="element-config" aria-label={`${entry.title} preview settings`}>
						<div id={`${entry.slug}-preview-controls`} className="controls-slot"></div>
					</aside>
				</div>
			</div>

			<div className="wrap element-docs">
				<p className="element-description">{entry.description}</p>
				<div className="prose">
					<h2 id="after-installation">After installation</h2>
					{isWrapper ? (
						<>
							<p>
								Download the TSX or confirm installation in Studio, then wrap the Elements you want
								to affect in{' '}
								<code>
									&lt;{wrapperName}&gt;…&lt;/{wrapperName}&gt;
								</code>
								. The wrapper is empty until you add children; it does not automatically wrap
								selected layers. The preview's visualizers and title are demo content, not bundled
								dependencies.
							</p>
							<pre>
								<code dangerouslySetInnerHTML={{__html: highlightCode(wrapperExample)}} />
							</pre>
							<p>
								Match child dimensions to the wrapper and position stacked layers absolutely. Each
								Element keeps its own Sequence; moving the wrapper moves the group. Select the
								wrapper in Studio for effect controls. Set <code>{bypassKey}</code> to zero for a
								clean bypass.
							</p>
						</>
					) : (
						<>
							<p>
								The Studio protocol handles source installation and insertion, so this workflow does
								not require a manual import. Confirm the request in Studio, then select the inserted
								Element to adjust its Interactive controls.
							</p>
							<p>
								No props are required. With the demo track, Studio copies it to{' '}
								<code>public/banger-elements/</code> so the Element plays offline.
								{texture && (
									<>
										{' '}
										Studio also copies the texture to <code>{texture}</code>, unless you set your
										own image in the preview.
									</>
								)}{' '}
								With your own track, the installed source uses the audio URL from your preview.
								Local files need a hosted URL before installation. See{' '}
								<Link to="/getting-started#audio-setup">audio setup</Link> to use your own track, or
								copy the configured JSX from the preview controls for use with the original source.
							</p>
							{entry.category === 'shaders' && (
								<p>
									{entry.title} fills the composition you install it into, at any aspect ratio. If
									you change the preview's width or height, the installed Element keeps that fixed
									size instead.
								</p>
							)}
						</>
					)}
					<details className="reference-section" open>
						<summary>
							<h2 id="controls">Key controls</h2>
						</summary>
						<ul>
							{entry.controls.map((control) => (
								<li key={control}>{control}</li>
							))}
						</ul>
						{isWrapper ? (
							<p>
								{entry.title} exposes size and transform controls, but no audio controls. The Demo
								audio tab changes only the preview children. Copy configured JSX to reuse your
								effect settings around your own content.
							</p>
						) : (
							<p>
								Visualizers and shaders expose <code>audioSrc</code>,{' '}
								<code>audioOffsetInSeconds</code>, <code>playAudio</code>, <code>inputGainDb</code>,{' '}
								<code>width</code> and <code>height</code>. Select the Element itself in Studio to
								see its Interactive controls.
							</p>
						)}
					</details>
					<details className="reference-section" open>
						<summary>
							<h2 id="limitations">Before you render</h2>
						</summary>
						<aside className="limitation">{entry.limitation}</aside>
						{entry.renderer === 'WebGL2' && (
							<p>
								Depending on your rendering environment, you may need to enable ANGLE when rendering
								with Remotion. If the element renders blank or reports a WebGL error, try adding{' '}
								<code>--gl=angle</code> to your <code>remotion render</code> command. See{' '}
								<Link to="/getting-started#rendering-with-angle">Rendering with ANGLE</Link>.
							</p>
						)}
						{isWrapper ? (
							<p>
								{entry.title} does not play or analyze audio. Enable audio on only one child when
								stacking visualizers. Child motion remains driven by Remotion's timeline.
							</p>
						) : (
							<p>
								Playback is enabled by default. Stacking elements? Enable only one audio track.
								Analysis gain affects visuals, not playback volume. Each instance decodes its own
								fixed audio windows, so stacked instances use more memory.
							</p>
						)}
					</details>
				</div>
			</div>

			<section className="wrap element-next" aria-labelledby="next-title">
				<NextCard next={next} />
				<div className="sibling-strip">
					<p className="kicker">All {category.title.toLowerCase()}</p>
					<ul>
						{siblings.map((element) => (
							<li key={element.slug}>
								<Link
									to={elementPath(element.slug)}
									aria-current={element.slug === entry.slug ? 'page' : undefined}
								>
									<img
										src={`/posters/${element.slug}.webp`}
										alt=""
										width="96"
										height="54"
										loading="lazy"
										decoding="async"
									/>
									<span>{element.title}</span>
								</Link>
							</li>
						))}
					</ul>
				</div>
			</section>
		</>
	);
}
