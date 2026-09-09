# VHS

A standalone wrapper that applies VHS-style displacement, grain and tracking bands
to its children. The browser composites the group and
filters it with SVG primitives. This is a browser-native adaptation of
banger.show's VHS effect, not a pixel-identical GLSL port.

## Use

Install or download `vhs.tsx`, then move your existing JSX inside the wrapper:

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
not automatically wrap selected layers. The site exports configured wrapper JSX;
demo audio settings are never exported as VHS props.

Only descendants are filtered. Portals outside the wrapper and sibling layers
are unaffected. Set child dimensions explicitly and use absolute positioning to
stack them. The wrapper clips to its drawing bounds. `strength={0}` bypasses the
filter and tracking overlays completely.

## Timing and controls

The wrapper owns its Sequence; children retain theirs. Moving VHS moves the group.
Animation is derived from its local frame and FPS; `timeOffsetInSeconds` changes
the effect phase without trimming child media. `period` changes tracking phase,
not accumulated playback speed. Select the wrapper for its Interactive controls.

- `horizontalDistortion`: broad horizontal displacement.
- `glitch`: fine row jitter.
- `line` / `period`: tracking band strength and speed.
- `strength`: overall effect amount, including complete bypass.

VHS never plays or analyzes audio. Enable playback on only one child when stacking
visualizers. No required font, shared runtime, wall-clock animation, asynchronous
capture or manual GPU resource allocation is introduced by the wrapper.

## Rendering and limitations

SVG turbulence replaces the original shader noise. This implementation does not
reproduce the upstream color pipeline, edge sampling or bottom-edge UV distortion.
Grain is masked to displaced content. Tracking and bottom-edge overlays may mark
otherwise transparent areas within the wrapper.

Validated in Remotion 4.0.520 with Chromium ANGLE. Child WebGL Elements still need
graphics acceleration. Filtering large groups increases rendering cost; test your
actual output dimensions. No broad browser-compatibility claim is made.

Reference: `banger.show/packages/visual-engine/src/components/effects/layered/passes/vhs.ts`.
The reference repository is not modified or imported.

## Validation

```sh
bun run build:elements
node apps/studio/scripts/vhs-regression.mjs
```

Output: `out/vhs-regression/`. The isolated test root does not register temporary
test compositions in the normal Studio workspace. It exercises generated source
with locally generated silence, requiring no user media or network assets.

The script renders mixed WebGL/SVG/HTML children and independent wrapper instances.
It asserts identical PNGs for 30/60 FPS at matching times, bypass versus unwrapped
content, delayed wrapper local timing, direct versus sequential rendering, and
concurrency 1 versus 4. Unit and source-contract tests are in
`packages/elements/tests/vhs.test.ts`.

The maintained `Vhs` gallery composition renders the same demo used by the site;
its children live outside the standalone Element. The temporary `VHSTest`
composition has been removed.
