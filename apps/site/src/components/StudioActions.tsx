import {useEffect, useMemo, useState} from 'react';
import {configuredPayload, type SourcePayload} from './configured-source';
import type {PreviewProps} from './preview/types';
import {
	addElementLibraryToStudio,
	installInStudio,
	isInsideStudio,
	setStudioDragData,
	type AddElementLibraryToStudioErrorCode,
	type InstallInStudioErrorCode,
	type StudioElementPayload,
} from '@remotion/studio-protocol';

// Next steps for the failures Remotion's library guide asks libraries to explain.
const nextStep: Partial<
	Record<InstallInStudioErrorCode | AddElementLibraryToStudioErrorCode, string>
> = {
	'no-compatible-studio': 'Start Remotion Studio on a port between 3000 and 3009, then try again.',
	'no-installable-target': 'Focus the Remotion Studio tab to install into, then try again.',
	'no-configurable-target': 'Focus the Remotion Studio tab to add the library to, then try again.',
	'no-config-file': 'Add a remotion.config.ts file to your project, then try again.',
	'studio-upgrade-required':
		'Upgrade Remotion in your project with npx remotion upgrade, then try again.',
	'loopback-network-permission-denied':
		'Allow local network access for this site in your browser, then try again.',
};

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
						// Same URL and name as `npx remotion elements add-library https://banger-elements.dev`,
						// which reads og:site_name, so Studio doesn't list the collection twice.
						url: new URL('/', location.href).href,
						displayName: 'Banger Elements',
					})
				: await installInStudio({payload: payload!});
			setMessage(
				result.success
					? `Awaiting confirmation in ${result.target.studioOrigin}. Review and approve there; nothing is installed yet.${library ? ' After approval, restart Studio to load the catalog.' : ''}`
					: `${result.message} ${nextStep[result.code] ?? 'Try again, or download the TSX instead.'}`,
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
				{error || message}
			</p>
		</div>
	);
}
