import {useEffect, useState} from 'react';
import {defaultAudioFor, type PreviewKind} from './examples';

type LocalAsset = {name: string; url: string};

export function usePreviewAudio(kind: PreviewKind) {
	const [audioUrl, setAudioUrl] = useState(() => defaultAudioFor(kind));
	const [audioDraft, setAudioDraft] = useState(audioUrl);
	const [localAudio, setLocalAudio] = useState<LocalAsset | null>(null);

	useEffect(() => {
		const url = defaultAudioFor(kind);
		setAudioUrl(url);
		setAudioDraft(url);
	}, [kind]);
	useEffect(
		() => () => {
			if (localAudio) URL.revokeObjectURL(localAudio.url);
		},
		[localAudio],
	);

	return {
		audioUrl,
		audioDraft,
		setAudioUrl,
		setAudioDraft,
		localAudio,
		chooseAudio: (file: File) => setLocalAudio({name: file.name, url: URL.createObjectURL(file)}),
		clearAudio: () => setLocalAudio(null),
		resetAudio: () => {
			setLocalAudio(null);
			const url = defaultAudioFor(kind);
			setAudioUrl(url);
			setAudioDraft(url);
		},
	};
}

export function usePreviewArtwork() {
	const [artworkFile, setArtworkFile] = useState<File | null>(null);
	const [localArtwork, setLocalArtwork] = useState<LocalAsset | null>(null);
	const [artworkError, setArtworkError] = useState('');

	useEffect(() => {
		setLocalArtwork(null);
		setArtworkError('');
		if (!artworkFile) return;
		const url = URL.createObjectURL(artworkFile);
		const image = new Image();
		let active = true;
		image.onload = () => {
			if (active) setLocalArtwork({name: artworkFile.name, url});
		};
		image.onerror = () => {
			if (active)
				setArtworkError('This image could not be opened. Try a PNG, JPEG, WebP, or SVG file.');
		};
		image.src = url;
		return () => {
			active = false;
			image.onload = null;
			image.onerror = null;
			URL.revokeObjectURL(url);
		};
	}, [artworkFile]);

	return {artworkFile, setArtworkFile, localArtwork, artworkError};
}
