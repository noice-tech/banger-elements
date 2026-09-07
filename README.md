# Banger Elements

Audio-reactive elements for [Remotion](https://remotion.dev), from the makers of [banger.show](https://banger.show).

![Animated previews of Spectre, Circle, Ferrofluid, and Audio Particles](docs/assets/preview.gif)

**v0.1.0** — each element is an editable TSX file you add to your project, not a runtime library.

## Use

Preview an element, then install it in Remotion Studio or download its source.

See [Getting started](apps/site/src/content/docs/getting-started.mdx) for setup and usage.

## Run locally

Requires Node.js 24.18.1 and Bun 1.3.8.

```bash
bun install
bun run dev
```

Open the showcase at [localhost:3300](http://localhost:3300). This also starts Remotion Studio.

## Development

- `packages/elements` — element source and collection build
- `apps/site` — showcase and docs
- `apps/studio` — Remotion compositions

Run `bun run check` for formatting, lint, types, and tests.

## License

[MIT](LICENSE) © 2026 Noice Tech. Remotion and other dependencies have their own licenses.
