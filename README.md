# Banger Elements

Visualizers and shaders for [Remotion](https://remotion.dev) that react to your music, plus effects to wrap them in. From the makers of [banger.show](https://banger.show).

The visualizers and shaders read your track frame by frame, so a kick or a drop changes what you see. You play each element on the site with music, change its settings, and then install it in Remotion Studio like any other [Remotion Element](https://www.remotion.dev/docs/elements), or download the TSX file.

![A grid of 12 element previews: Synthwave, Ferrofluid, Flowers, Trip, Liquid, Pulsar, Chrome, Halo, Rail, Kaleidoscope, Wet Glass and Neuron](docs/assets/preview.webp)

## The collection

The collection has 33 elements in three groups:

- [Visualizers](https://banger-elements.dev/visualizers) (8) draw audio as waveforms, spectra, rings, fluid and particles.
- [Shaders](https://banger-elements.dev/shaders) (22) are full-frame procedural backgrounds that follow the track, such as Trip, Synthwave, Rain and Matrix.
- [Effects](https://banger-elements.dev/effects) (3) wrap other content. VHS adds analog tape texture, Fisheye adds lens distortion, and Wet Glass puts the frame behind a rainy window.

The [examples page](https://banger-elements.dev/examples) has four finished compositions built only from the collection: an audiogram, a release teaser, a vertical loop and a stream background. Each one shows the code that rendered it.

## Getting started

Elements need Remotion 4.0.536 or later. Downloaded files import only React, `remotion`, `@remotion/media` and `@remotion/media-utils`.

### Install from the site

1. Open your Remotion project in Studio.
2. Pick an element on the [site](https://banger-elements.dev) and adjust its preview settings.
3. Click **Install in Studio** and confirm the request in Studio. The installed file uses your preview settings as its defaults. You can also download the TSX.
4. Pass your audio to a visualizer or shader, or move your existing layers inside an effect.

### Install from the command line

Pass an element's page URL and your composition ID (Remotion 4.0.542 or later). The CLI installs the element with its original defaults.

```bash
npx remotion elements use https://banger-elements.dev/halo --composition MyComposition
```

### Add the whole collection

To browse every element in Studio's Browse Elements panel, click **Add Library to Studio** on the site, or run this from your project (Remotion 4.0.547 or later):

```bash
npx remotion elements add-library https://banger-elements.dev
```

Restart Studio afterwards to see the collection.

### Size and rendering

Shaders fill whatever composition you place them in, including vertical and square ones. Visualizers and effects draw in a 1280×720 box that you can resize with `width` and `height`.

WebGL elements may need `--gl=angle` when you render, or `--gl=swangle` on a machine without a GPU.

The [getting started guide](apps/site/src/content/docs/getting-started.mdx) covers audio setup, timing, effects and rendering.

### For coding agents

[llms.txt](https://banger-elements.dev/llms.txt) indexes the collection, and every page has a Markdown version at its URL plus `.md`, such as [halo.md](https://banger-elements.dev/halo.md).

## Run locally

You need Node.js 24.22.3 and Bun 1.3.8.

```bash
bun install
bun run dev
```

This serves the site at [localhost:3300](http://localhost:3300) and starts Remotion Studio.

## Development

- `packages/elements` has the element source and the collection build.
- `apps/site` is the Astro site with the showcase, examples and docs. Its [README](apps/site/README.md) explains the home page scenes and the "Wrap anything" demos.
- `apps/studio` has the Remotion compositions used for smoke tests and renders.

`bun run check` runs the format check, lint, type checks and tests. `bun run smoke` renders each Studio fixture to `out/`.

## License

[MIT](LICENSE) © 2026 Noice Tech. Remotion and other dependencies have their own licenses.
