#!/usr/bin/env node
// Copyright 2026 Example
// Licensed under the MIT license, and this continuation line stays.
/* eslint-disable no-console -- the tool directive stays */
// EXTERNAL: Chrome drops the first frame after a context loss, so the canvas redraws once.
// Based on: https://iquilezles.org/articles/smin
// EXTERNAL: A note that runs on,
// so its second line is a comment.
// EXTERNAL: A note that is far too long to stay, because it keeps explaining the background of the trap at length.

// Restating the next line.
const speed = 2;

/** JSDoc on an export stays. */
export const size = 4;

/** JSDoc on a local declaration is still a comment. */
const local = 3;

export type Props = {
	/** JSDoc on a member of an exported type stays. */
	level: number;
};

type LocalProps = {
	/** JSDoc on a member of a local type is a comment. */
	level: number;
};

export const config = {
	/** JSDoc on a property of an exported object stays. */
	speed,
	run() {
		const inner = {
			/** JSDoc inside a function body is a comment. */
			local,
		};
		return inner;
	},
};

const shader = /* glsl */ `
uniform float iTime;
// Restating code inside GLSL.
// EXTERNAL: WebGL1 needs a constant loop bound.
void main() {
	/* A block comment in GLSL. */
	gl_FragColor = vec4(iTime);
}
`;

const shaderChunk = `
// A comment in a GLSL helper with no uniform or main.
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5);
}
`;

const notShader = `
// This template literal holds no GLSL, so its text is a string.
`;

export const View = ({level}: Props) => (
	<div>
		{/* A JSX comment. */}
		{level}
	</div>
);

void shader;
void shaderChunk;
void notShader;
void ({} as LocalProps);
