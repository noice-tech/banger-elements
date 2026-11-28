import {Link} from 'react-router';
import lockup from '../../assets/brand/banger-elements.svg?raw';

const mark = lockup.replace(
	'<svg ',
	'<svg class="brand-mark" aria-hidden="true" focusable="false" ',
);

export const Brand = () => (
	<Link
		className="brand-lockup"
		to="/"
		aria-label="Banger Elements home"
		dangerouslySetInnerHTML={{__html: mark}}
	/>
);
