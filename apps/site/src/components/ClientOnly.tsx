import {useEffect, useState, type ReactNode} from 'react';

/** Renders browser-only UI after hydration; the prerendered page shows `fallback`. */
export const ClientOnly = ({
	children,
	fallback = null,
}: {
	children: () => ReactNode;
	fallback?: ReactNode;
}) => {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);
	return hydrated ? children() : fallback;
};
