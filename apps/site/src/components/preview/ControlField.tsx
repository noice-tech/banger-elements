import type {Control} from './controls';
import type {PreviewValue as Value} from '../preview-config';

export const ControlField = ({
	control,
	value,
	update,
	disabled = false,
	reset,
	automatic = false,
}: {
	control: Control;
	value: Value;
	update: (value: Value) => void;
	disabled?: boolean;
	reset?: () => void;
	automatic?: boolean;
}) => {
	if (control.type === 'boolean')
		return (
			<label className="toggle-control">
				<input
					type="checkbox"
					checked={Boolean(value)}
					onChange={(event) => update(event.target.checked)}
				/>
				<span>{control.label}</span>
			</label>
		);
	if (control.type === 'select')
		return (
			<label>
				<span>{control.label}</span>
				<select
					value={String(value)}
					onChange={(event) =>
						update(typeof value === 'number' ? Number(event.target.value) : event.target.value)
					}
				>
					{control.options?.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</label>
		);
	if (control.type === 'number')
		return (
			<label>
				<span>{control.label}</span>
				<input
					type="number"
					min={control.min}
					max={control.max}
					step={control.step}
					value={Number(value)}
					onChange={(event) => update(Number(event.target.value))}
				/>
			</label>
		);
	if (control.type === 'color')
		return (
			<div className="color-field" data-disabled={disabled || undefined}>
				<label>
					<span>{control.label}</span>
					<span className="color-control">
						<input
							type="color"
							aria-label={control.label}
							disabled={disabled}
							value={String(value)}
							onChange={(event) => update(event.target.value)}
						/>
						<output>
							{String(value)}
							{automatic ? ' · auto' : ''}
						</output>
					</span>
				</label>
				{reset ? (
					<button
						type="button"
						className="color-auto"
						onClick={reset}
						disabled={automatic}
						aria-label="Use automatic leading edge color"
					>
						Auto
					</button>
				) : null}
			</div>
		);
	return (
		<label>
			<span>
				{control.label}
				<output>
					{Number(value).toFixed((control.step ?? 1) <= 0.01 ? 2 : (control.step ?? 1) < 1 ? 1 : 0)}
				</output>
			</span>
			<input
				type="range"
				aria-label={control.label}
				min={control.min}
				max={control.max}
				step={control.step}
				value={Number(value)}
				onChange={(event) => update(Number(event.target.value))}
			/>
		</label>
	);
};
