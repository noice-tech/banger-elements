import {createElement, type ComponentType, type ReactNode} from 'react';
import {AbsoluteFill} from 'remotion';
import {sceneElements} from './elements';
import type {BuiltScene, PropValue, SceneNode} from './model';

type AnyElement = ComponentType<Record<string, unknown>>;

const value = (prop: PropValue) => (typeof prop === 'object' ? prop.value : prop);

const renderNode = (
	node: SceneNode | string,
	key: number,
	shared: Record<string, unknown>,
	live: boolean,
): ReactNode => {
	if (typeof node === 'string') return node;
	const children = node.children?.map((child, index) => renderNode(child, index, shared, live));
	if (node.kind === 'box') {
		const tag = node.tag === 'AbsoluteFill' ? AbsoluteFill : node.tag;
		return createElement(tag, {key, style: node.style}, ...(children ?? []));
	}
	const component = sceneElements[node.slug as keyof typeof sceneElements] as unknown as
		| AnyElement
		| undefined;
	if (!component) throw new Error(`Scene element not registered: ${node.slug}`);
	const props: Record<string, unknown> = node.shared ? {...shared} : {};
	// Live, the stage plays the track itself so a layer can change without a gap.
	if (node.playAudio && !live) props.playAudio = true;
	for (const [name, prop] of Object.entries(node.props)) props[name] = value(prop);
	if (node.style) props.style = node.style;
	return createElement(component, {key, ...props}, ...(children ?? []));
};

export const SceneComposition = ({
	scene,
	audioSrc,
	live = false,
}: {
	scene: BuiltScene;
	audioSrc?: string;
	live?: boolean;
}) => {
	const shared = {
		audioSrc: audioSrc ?? scene.track.src,
		audioOffsetInSeconds: scene.start,
		playAudio: false,
		width: scene.width,
		height: scene.height,
	};
	return renderNode(scene.root, 0, shared, live);
};
