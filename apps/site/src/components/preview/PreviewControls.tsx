import {useEffect, useState, type Dispatch, type SetStateAction} from 'react';
import {configuredJsx, isAdvancedControl} from '../preview-config';
import {examples, type PreviewKind} from './examples';
import {booleanControl, numberControl, type Control} from './controls';
import {ControlField} from './ControlField';
import type {PreviewProps, PreviewValue} from './types';
import type {usePreviewAudio, usePreviewArtwork} from './use-preview-assets';

type PreviewControlsProps = {
	slug: PreviewKind;
	customProps: PreviewProps;
	inputProps: PreviewProps;
	setCustomProps: Dispatch<SetStateAction<PreviewProps>>;
	reset: () => void;
	audio: ReturnType<typeof usePreviewAudio>;
	artwork: ReturnType<typeof usePreviewArtwork>;
};

export function PreviewControls({
	slug,
	customProps,
	inputProps,
	setCustomProps,
	reset,
	audio,
	artwork,
}: PreviewControlsProps) {
	const selected = slug;
	const example: {props: PreviewProps; controls: readonly Control[]} = examples[selected];
	const [panel, setPanel] = useState<'look' | 'audio' | 'more'>('look');
	const [copyMessage, setCopyMessage] = useState('');
	const {audioUrl, audioDraft, setAudioUrl, setAudioDraft, localAudio, chooseAudio, clearAudio} =
		audio;
	const {artworkFile, setArtworkFile, localArtwork, artworkError} = artwork;
	useEffect(() => setCopyMessage(''), [inputProps]);
	const update = (key: string, value: PreviewValue) => {
		setCustomProps((current) => ({...current, [key]: value}));
	};
	const presets =
		selected === 'ferrofluid'
			? [
					{label: 'Studio metal', props: examples.ferrofluid.props},
					{
						label: 'Polished chrome',
						props: {
							...examples.ferrofluid.props,
							color: '#aab1c0',
							shineColor: '#d4e5ff',
							roughness: 0.05,
							iridescence: 0,
							intensity: 1.4,
						},
					},
					{
						label: 'Ultraviolet',
						props: {
							...examples.ferrofluid.props,
							color: '#27123e',
							shineColor: '#d5a2ff',
							roughness: 0.22,
							iridescence: 0.8,
							intensity: 2.8,
						},
					},
				]
			: [];
	const activePreset = presets.findIndex((preset) =>
		Object.entries(preset.props).every(([key, value]) => customProps[key] === value),
	);
	const copyConfiguration = async () => {
		try {
			await navigator.clipboard.writeText(configuredJsx(slug, inputProps, Boolean(localAudio)));
			setCopyMessage(
				slug !== 'vhs' && (localAudio || localArtwork)
					? 'Copied. Replace local asset paths with your project files.'
					: 'Configuration copied. Paste inside your composition.',
			);
		} catch {
			setCopyMessage('Clipboard unavailable. Select and copy the configuration below.');
		}
	};

	return (
		<section className="preview-controls" aria-label={`${slug} preview controls`}>
			<div className="controls-heading">
				<div>
					<strong>Preview settings</strong>
					<span>Changes apply live.</span>
				</div>
				<button
					type="button"
					onClick={() => {
						setCopyMessage('');
						reset();
					}}
				>
					Reset
				</button>
			</div>
			<div className="inspector-tabs" role="tablist" aria-label="Preview settings">
				{(['look', 'audio', 'more'] as const).map((tab, index, tabs) => (
					<button
						key={tab}
						type="button"
						role="tab"
						id={`${slug}-tab-${tab}`}
						aria-selected={panel === tab}
						aria-controls={`${slug}-panel-${tab}`}
						tabIndex={panel === tab ? 0 : -1}
						onClick={() => setPanel(tab)}
						onKeyDown={(event) => {
							const next =
								event.key === 'ArrowRight'
									? (index + 1) % tabs.length
									: event.key === 'ArrowLeft'
										? (index + tabs.length - 1) % tabs.length
										: event.key === 'Home'
											? 0
											: event.key === 'End'
												? tabs.length - 1
												: -1;
							if (next < 0) return;
							event.preventDefault();
							setPanel(tabs[next]!);
							document.getElementById(`${slug}-tab-${tabs[next]}`)?.focus();
						}}
					>
						{tab === 'look'
							? 'Look'
							: tab === 'audio'
								? slug === 'vhs'
									? 'Demo audio'
									: 'Audio'
								: 'More'}
					</button>
				))}
			</div>
			<div
				role="tabpanel"
				id={`${slug}-panel-audio`}
				aria-labelledby={`${slug}-tab-audio`}
				hidden={panel !== 'audio'}
				tabIndex={0}
			>
				{slug === 'vhs' ? (
					<p className="control-note">
						Audio drives the demo children only. VHS itself has no audio controls or analysis.
					</p>
				) : null}
				<div className="audio-controls">
					<label className="wide-control">
						<span>Audio URL</span>
						<input
							type="url"
							value={audioDraft}
							disabled={Boolean(localAudio)}
							onChange={(event) => setAudioDraft(event.target.value)}
							placeholder="https://example.com/track.mp3"
						/>
					</label>
					<button
						type="button"
						disabled={Boolean(localAudio) || audioDraft === audioUrl}
						onClick={() => setAudioUrl(audioDraft)}
					>
						Use audio URL
					</button>
					<label className="file-control">
						<span>Or choose local audio</span>
						<input
							type="file"
							accept="audio/*"
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (!file) return;
								chooseAudio(file);
							}}
						/>
					</label>
					{localAudio ? (
						<button
							type="button"
							onClick={() => {
								clearAudio();
							}}
						>
							Use URL instead
						</button>
					) : null}
					<label>
						<span>
							Audio offset{' '}
							<output>{Number(customProps.audioOffsetInSeconds ?? 0).toFixed(1)}s</output>
						</span>
						<input
							type="range"
							aria-label="Audio offset"
							min="0"
							max="60"
							step="0.1"
							value={Number(customProps.audioOffsetInSeconds ?? 0)}
							onChange={(event) => update('audioOffsetInSeconds', Number(event.target.value))}
						/>
					</label>
					<ControlField
						control={booleanControl('playAudio', 'Play audio')}
						value={customProps.playAudio ?? true}
						update={(value) => update('playAudio', value)}
					/>
				</div>
				<p className="control-note">
					Remote media must allow CORS. Local files stay in your browser and are never uploaded.
				</p>
			</div>
			<div
				role="tabpanel"
				id={`${slug}-panel-more`}
				aria-labelledby={`${slug}-tab-more`}
				hidden={panel !== 'more'}
				tabIndex={0}
			>
				<p className="inspector-section-label">CANVAS & ADVANCED</p>
				<div className="visual-controls">
					<ControlField
						control={numberControl('width', 'Element width', 16, 3840, 1)}
						value={customProps.width}
						update={(value) => update('width', value)}
					/>
					<ControlField
						control={numberControl('height', 'Element height', 16, 3840, 1)}
						value={customProps.height}
						update={(value) => update('height', value)}
					/>
					{example.controls
						.filter((control) => isAdvancedControl(control.key))
						.map((control) => (
							<ControlField
								key={control.key}
								control={control}
								value={customProps[control.key] ?? example.props[control.key]}
								update={(value) => update(control.key, value)}
							/>
						))}
				</div>
			</div>
			<div
				role="tabpanel"
				id={`${slug}-panel-look`}
				aria-labelledby={`${slug}-tab-look`}
				hidden={panel !== 'look'}
				tabIndex={0}
			>
				{presets.length > 0 ? (
					<label className="preset-picker">
						<span>Starting point</span>
						<select
							aria-label="Preview preset"
							value={activePreset}
							onChange={(event) => {
								const preset = presets[Number(event.target.value)];
								if (preset) setCustomProps((current) => ({...current, ...preset.props}));
							}}
						>
							<option value={-1} disabled>
								Custom look
							</option>
							{presets.map((preset, index) => (
								<option key={preset.label} value={index}>
									{preset.label}
								</option>
							))}
						</select>
					</label>
				) : null}
				<p className="inspector-section-label">SHAPE & APPEARANCE</p>
				<div className="visual-controls">
					{example.controls
						.filter((control) => !isAdvancedControl(control.key))
						.map((control) => (
							<ControlField
								key={control.key}
								control={control}
								value={
									customProps[control.key] ??
									(selected === 'halo' && control.key === 'leadingColor'
										? customProps.colorMode === 'gradient'
											? customProps.startColor
											: '#ffffff'
										: example.props[control.key])
								}
								disabled={
									selected === 'halo' &&
									((customProps.colorMode !== 'gradient' &&
										['startColor', 'endColor'].includes(control.key)) ||
										(customProps.centerMode === 'transparent' && control.key === 'centerColor'))
								}
								automatic={
									selected === 'halo' &&
									control.key === 'leadingColor' &&
									customProps.leadingColor === undefined
								}
								reset={
									selected === 'halo' && control.key === 'leadingColor'
										? () =>
												setCustomProps((current) => {
													const next = {...current};
													delete next.leadingColor;
													return next;
												})
										: undefined
								}
								update={(value) => update(control.key, value)}
							/>
						))}
				</div>
				{selected === 'halo' && customProps.colorMode !== 'gradient' ? (
					<p className="control-note">
						Switch to Gradient to use start/end colors. Leading edge works in both color modes.
					</p>
				) : null}
				{selected === 'halo' ? (
					<div className="artwork-controls artwork-control">
						{customProps.centerMode === 'transparent' ? (
							<p className="control-note">
								The center is transparent. Color and artwork settings are kept for Filled mode.
							</p>
						) : null}
						<label className="wide-control">
							<span>Optional artwork URL</span>
							<input
								type="url"
								value={String(customProps.artworkSrc ?? '')}
								disabled={Boolean(artworkFile) || customProps.centerMode === 'transparent'}
								onChange={(event) => update('artworkSrc', event.target.value)}
								placeholder="https://example.com/cover.jpg"
							/>
						</label>
						<label className="file-control">
							<span>Or choose local artwork</span>
							<input
								type="file"
								accept="image/*"
								disabled={customProps.centerMode === 'transparent'}
								onChange={(event) => {
									const file = event.currentTarget.files?.[0];
									event.currentTarget.value = '';
									if (!file) return;
									setArtworkFile(file);
									setCopyMessage('');
								}}
							/>
						</label>
						{artworkFile ? (
							<>
								<p className="control-note" role="status">
									{artworkFile.name}
									{!localArtwork && !artworkError ? ' — loading…' : ''}
								</p>
								<button
									type="button"
									onClick={() => {
										setArtworkFile(null);
										update('artworkSrc', '');
									}}
								>
									Remove artwork
								</button>
							</>
						) : null}
						{artworkError ? (
							<p className="control-note" role="alert">
								{artworkError}
							</p>
						) : null}
						<p className="control-note">
							Local images stay in your browser and are never uploaded.
						</p>
					</div>
				) : null}
			</div>
			<details className="configuration-export">
				<summary>Use these settings in code</summary>
				<p className="control-note">
					Preview settings are separate from the installed source defaults.
				</p>
				<button type="button" className="button" onClick={copyConfiguration}>
					Copy configured JSX
				</button>
				<p className="control-note" role="status">
					{copyMessage}
				</p>
				<pre tabIndex={0} aria-label="Configured JSX">
					<code>{configuredJsx(slug, inputProps, Boolean(localAudio))}</code>
				</pre>
			</details>
		</section>
	);
}
