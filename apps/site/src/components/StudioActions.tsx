import {useEffect, useMemo, useState} from 'react';
import {configuredPayload, type SourcePayload} from './configured-source';
import type {PreviewProps} from './preview/types';
import {
	addElementLibraryToStudio,
	installInStudio,
	isInsideStudio,
	setStudioDragData,
	type StudioElementPayload,
} from '@remotion/studio-protocol';

export default function StudioActions({
	slug,
	previewProps,
	assetPending = false,
}: {
	slug?: string;
	previewProps?: PreviewProps;
	assetPending?: boolean;
}) {
	const [template, setTemplate] = useState<SourcePayload | null>(null);
	const {payload, error} = useMemo<{payload: StudioElementPayload | null; error: string}>(() => {
		if (!template || !previewProps) return {payload: null, error: ''};
		if (assetPending)
			return {payload: null, error: 'Use a hosted image URL before you install this element.'};
		try {
			return {payload: configuredPayload(template, previewProps), error: ''};
		} catch (error) {
			return {payload: null, error: error instanceof Error ? error.message : String(error)};
		}
	}, [template, previewProps, assetPending]);
	const [message, setMessage] = useState('');
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		if (!slug) return;
		setTemplate(null);
		const controller = new AbortController();
		fetch(`/elements/${slug}.json`, {signal: controller.signal})
			.then(async (response) => {
				if (!response.ok)
					throw new Error(`Payload request failed (${response.status}). Reload to retry.`);
				setTemplate((await response.json()) as SourcePayload);
			})
			.catch((error: Error) => {
				if (!controller.signal.aborted) setMessage(error.message);
			});
		return () => controller.abort();
	}, [slug]);
	const request = async (library: boolean) => {
		setBusy(true);
		setMessage('Contacting Studio…');
		try {
			const result = library
				? await addElementLibraryToStudio({
						url: new URL('/index.html', location.href).href,
						displayName: 'banger-elements',
					})
				: await installInStudio({payload: payload!});
			setMessage(
				result.success
					? `Awaiting confirmation in ${result.target.studioOrigin}. Review and approve there; nothing is installed yet.${library ? ' After approval, restart Studio to load the catalog.' : ''}`
					: `${result.code}: ${result.message} Start a compatible Studio on ports 3000–3009 and try again.`,
			);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="studio-actions">
			<div className="actions">
				{slug ? (
					<>
						<button className="primary" disabled={!payload || busy} onClick={() => request(false)}>
							{slug === 'vhs' ? 'Install wrapper in Studio' : 'Install in Studio'}
						</button>
						<button
							disabled={!payload}
							draggable={Boolean(payload)}
							onDragStart={(event) => {
								if (!payload) {
									event.preventDefault();
									return;
								}
								setStudioDragData({dataTransfer: event.dataTransfer, payload});
								setMessage('Drop onto a Studio canvas, then confirm in Studio.');
							}}
						>
							Drag to Studio
						</button>
					</>
				) : null}
				{!slug && !isInsideStudio() ? (
					<button disabled={busy} onClick={() => request(true)}>
						Add Library to Studio
					</button>
				) : null}
			</div>
			<p role="status" aria-live="polite">
				{error || message}
			</p>
		</div>
	);
}
