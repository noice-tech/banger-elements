import {useEffect, useState} from 'react';
import {
	addElementLibraryToStudio,
	installInStudio,
	isInsideStudio,
	setStudioDragData,
	type StudioElementPayload,
} from '@remotion/studio-protocol';

export default function StudioActions({slug}: {slug?: string}) {
	const [payload, setPayload] = useState<StudioElementPayload | null>(null);
	const [message, setMessage] = useState('');
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		if (!slug) return;
		const controller = new AbortController();
		fetch(`/elements/${slug}.json`, {signal: controller.signal})
			.then(async (response) => {
				if (!response.ok)
					throw new Error(`Payload request failed (${response.status}). Reload to retry.`);
				setPayload((await response.json()) as StudioElementPayload);
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
							Install in Studio
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
				{message}
			</p>
		</div>
	);
}
