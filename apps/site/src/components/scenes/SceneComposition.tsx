import {createElement, type ComponentType, type ReactNode} from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import type {BuiltScene, PropValue, SceneNode} from './model';

type AnyElement = ComponentType<Record<string, unknown>>;
export type ElementRegistry = Readonly<Partial<Record<string, AnyElement>>>;

const value = (prop: PropValue) => (typeof prop === 'object' ? prop.value : prop);

const renderNode = (
	node: SceneNode | string,
	key: number,
	shared: Record<string, unknown>,
	live: boolean,
	elements: ElementRegistry,
): ReactNode => {
	if (typeof node === 'string') return node;
	const children = node.children?.map((child, index) =>
		renderNode(child, index, shared, live, elements),
	);
	if (node.kind === 'box') {
		const tag = node.tag === 'AbsoluteFill' ? AbsoluteFill : node.tag;
		return createElement(tag, {key, style: node.style}, ...(children ?? []));
	}
	const component = elements[node.slug];
	if (!component) throw new Error(`Scene element not registered: ${node.slug}`);
	const props: Record<string, unknown> = node.shared ? {...shared} : {};
	if (node.playAudio && !live) props.playAudio = true;
	for (const [name, prop] of Object.entries(node.props)) props[name] = value(prop);
	if (node.style) props.style = node.style;
	return createElement(component, {key, ...props}, ...(children ?? []));
};

export const SceneComposition = ({
	scene,
	audioSrc,
	elements,
	live = false,
}: {
	scene: BuiltScene;
	elements: ElementRegistry;
	audioSrc?: string;
	live?: boolean;
}) => {
	const shared = {
		audioSrc: audioSrc ?? staticFile(scene.track.asset),
		audioOffsetInSeconds: scene.start,
		playAudio: false,
		width: scene.width,
		height: scene.height,
	};
	return renderNode(scene.root, 0, shared, live, elements);
};
