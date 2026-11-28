import {
	installInStudio,
	setStudioDragData,
	type StudioElementPayload,
} from '@remotion/studio-protocol';
import {useEffect, useRef, useState, type DragEvent} from 'react';
import {Link} from 'react-router';
import {elementCategories, elements} from '../../data/elements';
import {nextStep} from '../studio-messages';
import {ElementTile} from './ElementTile';
import {SYNC_MEDIA_EVENT} from './media';

type CategoryId = (typeof elementCategories)[number]['id'];

const searchText = (entry: (typeof elements)[number]) =>
	`${entry.title} ${entry.tagline} ${entry.description}`.toLowerCase();

const payloads = new Map<string, Promise<StudioElementPayload>>();
const loaded = new Map<string, StudioElementPayload>();
const payloadFor = (slug: string) => {
	let request = payloads.get(slug);
	if (!request) {
		request = fetch(`/elements/${slug}.json`).then(async (response) => {
			if (!response.ok)
				throw new Error(`Could not load ${slug} (${response.status}). Reload to retry.`);
			const {type, version, element} = (await response.json()) as StudioElementPayload;
			const payload = {type, version, element} as StudioElementPayload;
			loaded.set(slug, payload);
			return payload;
		});
		request.catch(() => payloads.delete(slug));
		payloads.set(slug, request);
	}
	return request;
};

export const Collection = ({category}: {category?: CategoryId}) => {
	const all = !category;
	const categories = all ? elementCategories : elementCategories.filter(({id}) => id === category);
	const tabs = [
		{href: '/', title: 'All', current: all},
		...elementCategories.map(({id, title}) => ({href: `/${id}`, title, current: category === id})),
	];
	const [query, setQuery] = useState('');
	const [toast, setToast] = useState('');
	const [sending, setSending] = useState<string | null>(null);
	const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
	const toastTimer = useRef(0);
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const restore = () => setQuery(new URLSearchParams(location.search).get('q') ?? '');
		restore();
		window.addEventListener('pageshow', restore);
		return () => window.removeEventListener('pageshow', restore);
	}, []);
	useEffect(() => {
		document.dispatchEvent(new Event(SYNC_MEDIA_EVENT));
	}, [query]);
	useEffect(() => () => clearTimeout(toastTimer.current), []);

	const needle = query.trim().toLowerCase();
	const matches = (entry: (typeof elements)[number]) => searchText(entry).includes(needle);
	const count = elements.filter(
		(entry) => categories.some(({id}) => id === entry.category) && matches(entry),
	).length;

	const updateQuery = (value: string) => {
		setQuery(value);
		const url = new URL(location.href);
		if (value.trim()) url.searchParams.set('q', value.trim());
		else url.searchParams.delete('q');
		history.replaceState(history.state, '', url);
	};
	const announce = (message: string) => {
		setToast(message);
		clearTimeout(toastTimer.current);
		toastTimer.current = window.setTimeout(() => setToast(''), 6000);
	};
	const use = async (slug: string, title: string) => {
		setSending(slug);
		announce(`Sending ${title} to Remotion Studio…`);
		try {
			const result = await installInStudio({payload: await payloadFor(slug)});
			if (result.success) setSent((previous) => new Set(previous).add(slug));
			announce(
				result.success
					? `Confirm ${title} in ${result.target.studioOrigin} to finish installing it.`
					: (nextStep[result.code] ??
							`${result.message} Try again, or open the element to download its TSX.`),
			);
		} catch (error) {
			announce(error instanceof Error ? error.message : String(error));
		} finally {
			setSending(null);
		}
	};
	const drag = (slug: string) => (event: DragEvent) => {
		const payload = loaded.get(slug);
		if (payload) setStudioDragData({dataTransfer: event.dataTransfer, payload});
	};

	return (
		<div className="collection">
			<div className="collection-toolbar">
				<nav className="collection-filters" aria-label="Categories">
					{tabs.map((tab) => (
						<Link key={tab.href} to={tab.href} aria-current={tab.current ? 'page' : undefined}>
							{tab.title}
						</Link>
					))}
				</nav>
				<label className="collection-search">
					<svg
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="7" />
						<path d="m20 20-3.5-3.5" />
					</svg>
					<span className="sr-only">Filter elements</span>
					<input
						ref={input}
						type="search"
						placeholder="Filter by name or mood"
						autoComplete="off"
						value={query}
						onChange={(event) => updateQuery(event.target.value)}
					/>
				</label>
			</div>
			<p className="collection-status sr-only" role="status" aria-live="polite">
				{needle ? `${count} matching ${count === 1 ? 'element' : 'elements'}.` : ''}
			</p>
			{categories.map((entryCategory) => {
				const featured: readonly string[] = entryCategory.featured;
				const rank = (slug: string) =>
					featured.includes(slug) ? featured.indexOf(slug) : featured.length;
				const ordered = elements
					.filter((entry) => entry.category === entryCategory.id)
					.sort((a, b) => rank(a.slug) - rank(b.slug));
				return (
					<section
						key={entryCategory.id}
						className="collection-category"
						data-section={entryCategory.id}
						aria-labelledby={entryCategory.id}
						hidden={!ordered.some(matches)}
					>
						<h2 id={entryCategory.id} className={all ? 'category-heading' : 'sr-only'}>
							{entryCategory.title}
						</h2>
						<div className="collection-grid">
							{ordered.map((entry) => (
								<ElementTile
									key={entry.slug}
									slug={entry.slug}
									title={entry.title}
									tagline={entry.tagline}
									hidden={!matches(entry)}
									sending={sending === entry.slug}
									sent={sent.has(entry.slug)}
									onWarm={() => void payloadFor(entry.slug).catch(() => {})}
									onUse={() => void use(entry.slug, entry.title)}
									onDrag={drag(entry.slug)}
								/>
							))}
						</div>
					</section>
				);
			})}
			<div className="collection-empty" hidden={count > 0}>
				<p className="collection-empty-title">Nothing matches that.</p>
				<p>Try another word, or browse a different category.</p>
				<button
					className="button"
					type="button"
					onClick={() => {
						updateQuery('');
						input.current?.focus();
					}}
				>
					Clear filter
				</button>
			</div>
			<p className="studio-toast" role="status" aria-live="polite" hidden={!toast}>
				{toast}
			</p>
		</div>
	);
};
