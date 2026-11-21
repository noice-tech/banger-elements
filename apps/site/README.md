# Banger Elements Site

Astro + Starlight showcase for audio-reactive Remotion elements from [banger.show](https://banger.show).

## Development

From the repository root:

```bash
bun install
bun run dev
```

Open http://localhost:3300.

## Structure

- `src/pages/` — home, collection, element and example pages
- `src/components/` — previews, controls, navigation, and Studio integration
- `src/components/recipes/` — example compositions and their render settings; `bun run --filter @banger-elements/site recipes episode-clip` refreshes the audiogram's video and poster.
- `src/components/scenes/` — the home page scenes: data the live player renders and prints as code. `scripts/scenes.mjs` refreshes their posters and waveforms
- `src/components/wrap/` — the "Wrap anything" demos: each effect over plain children, rendered stacked on the unwrapped children so the page can split them. `scripts/wrap.mjs` renders them to `static/wrap/`
- `src/content/docs/` — Getting started
- `static/` — branding, fonts, posters, and preview videos

The downloadable `static/recipes/episode.mp3` is an original demo script synthesized with [Piper’s LJSpeech voice](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/high/MODEL_CARD). Caption cue times in `src/components/recipes/episode-clip.tsx` are relative to the start of the excerpt.
