# VHS

A standalone wrapper that applies Banger’s VHS shader to its children. On supported
Chromium, Remotion’s experimental HTML-in-canvas API captures HTML, SVG and canvas
children as one image and the wrapper processes that texture with WebGL2. Other
browsers receive a deterministic SVG approximation.

## Use

Requires Remotion 4.0.523 or newer. Install or download `vhs.tsx`, then move your
existing JSX inside the wrapper:

```tsx
import {Vhs} from './vhs.element';
import {Space} from './space.element';
import {Halo} from './halo.element';

<Vhs width={1280} height={720} horizontalDistortion={0.02}>
  <Space width={1280} height={720} playAudio={false} style={{position: 'absolute', inset: 0}} />
  <Halo width={1280} height={720} playAudio style={{position: 'absolute', inset: 0}} />
</Vhs>
```

Space and Halo are optional, separately installed demo children. The delivered
wrapper imports only React and Remotion. Installing it as a sibling does **not**
affect other layers: the wrapper is empty until you give it children. Studio does
not automatically wrap selected layers. Demo audio settings are never exported
as VHS props.

Only descendants are filtered. Portals outside the wrapper and sibling layers are
unaffected. Set child dimensions explicitly and use absolute positioning to stack
them. The wrapper clips to its drawing bounds. `strength={0}` bypasses both paths
and returns the children untouched.

## Timing and controls

The wrapper owns its Sequence; children retain theirs. Moving VHS moves the group.
Animation is derived from its local frame and FPS; `timeOffsetInSeconds` changes
the effect phase without trimming child media. `period` changes tracking phase,
not accumulated playback speed. Select the wrapper for its Interactive controls.

- `horizontalDistortion`: broad horizontal displacement.
- `glitch`: fine tape jitter.
- `line` / `period`: tracking tear strength and speed.
- `strength`: overall treatment, including exact bypass at zero.

VHS never plays or analyzes audio. Enable playback on only one child when stacking
visualizers. It has no shared Banger runtime and no wall-clock animation.

## Faithful shader path

The primary path ports the current layered shader from
`banger.show/packages/visual-engine/src/components/effects/layered/passes/vhs.ts`.
HTML-in-canvas supplies the composited child pixels as an `ElementImage`; the
wrapper uploads it to a WebGL texture and runs the original UV distortion, tracking
tear, bottom head-switch distortion, grain, brightness and color treatment. The
only shader addition is `strength`, which mixes the treated pixels with the source.
GPU programs, buffers, textures and vertex arrays are released on unmount.

Browser preview requires Chrome 149+ and the experimental flag:

1. Open `chrome://flags/#canvas-draw-element`.
2. Set **HTML-in-Canvas** to Enabled.
3. Restart Chrome.

Nested `<HtmlInCanvas>` wrappers are unsupported. Standard canvas children require
a sufficiently recent Chrome; update Chrome if nested child canvases do not paint.
The component automatically uses its SVG fallback when the API is unavailable.
That fallback preserves wrapper behavior and a VHS-like look, but is not shader
identical.

## Rendering

Remotion’s bundled render browser enables HTML-in-canvas automatically. WebGL needs
ANGLE or Swangle:

```sh
npx remotion render --gl=angle
# On a machine without a GPU:
npx remotion render --gl=swangle
```

Or set the local default:

```ts
Config.setChromiumOpenGlRenderer('angle');
```

HTML-in-canvas is an unstable browser API and may change or be removed. Rendering
large captured groups increases GPU and paint cost. Test the actual output size.
Transparent source regions have no pixels to distort, so prefer a full-bleed
background inside the wrapper.

## Validation

```sh
bun run build:elements
node apps/studio/scripts/vhs-regression.mjs
```

Output goes to `out/vhs-regression/`. The isolated root exercises generated source
with WebGL, SVG and HTML children. It asserts matching output for 30/60 FPS at the
same time, exact bypass versus unwrapped content, local timing after a delayed
start, direct versus sequential rendering, and concurrency 1 versus 4. Unit and
source-contract tests live in `packages/elements/tests/vhs.test.ts`.

The maintained `Vhs` gallery composition uses the same demo as the site; its demo
children live outside the standalone Element.
