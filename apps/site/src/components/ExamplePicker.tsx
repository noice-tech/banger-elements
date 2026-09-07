import {useId, useState} from 'react';
import {exampleGroups, examplePresets, type ExampleId} from '../data/example-presets';

export default function ExamplePicker({
	selected,
	onSelect,
}: {
	selected: string;
	onSelect: (id: ExampleId) => void;
}) {
	const id = useId();
	const [message, setMessage] = useState('');
	const active = examplePresets.find((preset) => preset.id === selected);
	if (!active) return null;
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(active.code);
			setMessage('Code copied.');
		} catch {
			setMessage('Clipboard unavailable. Select and copy the code below.');
		}
	};
	return (
		<div className="example-browser">
			<fieldset className="example-picker">
				<legend>Choose an example</legend>
				{exampleGroups.map((group) => (
					<div
						key={group}
						className="example-group"
						role="group"
						aria-labelledby={`${id}-${group}`}
					>
						<span id={`${id}-${group}`} className="example-group-label">
							{group}
						</span>
						<div className="example-options">
							{examplePresets
								.filter((preset) => preset.group === group)
								.map((preset) => (
									<label key={preset.id} className="example-option">
										<input
											type="radio"
											name={`${id}-example`}
											value={preset.id}
											checked={selected === preset.id}
											onChange={() => {
												setMessage('');
												onSelect(preset.id);
											}}
										/>
										<span>{preset.label}</span>
									</label>
								))}
						</div>
					</div>
				))}
			</fieldset>
			<section className="selected-example" aria-labelledby={`${id}-title`}>
				<p className="sr-only" role="status">
					Selected example: {active.label}
				</p>
				<h3 id={`${id}-title`}>{active.label}</h3>
				<p>{active.description}</p>
				<div className="example-links">
					{active.links.map((link) => (
						<a key={link.href} href={link.href}>
							{link.label} <span aria-hidden="true">↗</span>
						</a>
					))}
				</div>
				<div className="example-code-heading">
					<span>Basic usage</span>
					<button type="button" className="button" onClick={copy}>
						Copy code
					</button>
				</div>
				{active.id !== 'combined' && (
					<p className="example-code-note">
						This snippet selects the variant. The preview uses curated colors and audio settings.
					</p>
				)}
				<pre tabIndex={0} aria-label={`${active.label} code`}>
					<code>{active.code}</code>
				</pre>
				<p className="example-copy-status" role="status">
					{message}
				</p>
				{active.id === 'combined' && (
					<p className="example-code-note">
						Use the same audio source and offset for both elements. Keep their radius aligned when
						adjusting the mask. Both are WebGL2 elements; the extra canvas and audio analysis use
						more GPU time and memory.
					</p>
				)}
			</section>
		</div>
	);
}
