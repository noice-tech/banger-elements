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
- `src/components/scenes/` — the home page scenes: data the live player renders and prints as code. `scripts/scenes.mjs` refreshes their posters and waveforms. The first two scenes use [“Neon and Kickboxing” by Kevin MacLeod](https://archive.org/details/freepd), which he dedicated to the public domain ([CC0](https://creativecommons.org/publicdomain/zero/1.0/)) on FreePD
- `src/components/wrap/` — the "Wrap anything" demos: each effect over plain children, rendered stacked on the unwrapped children so the page can split them. `scripts/wrap.mjs` renders them to `static/wrap/`
- `src/content/docs/` — Getting started
- `static/` — branding, fonts, posters, and preview videos

`bun run --filter @banger-elements/site posters` converts the `bun run smoke` renders in `out/` into `static/posters/`, so run smoke first. Those fixtures use only the hosted demo audio and no artwork; never make these posters from local media.

Each example lists the dimensions, frame count, and frame rate to use when registering its TSX as a Remotion composition. The Studio render fixture loads the display fonts from `static/fonts/`; load Geist, Geist Mono, Syncopate, and Newsreader in your own composition to match the typography where used.

The downloadable `static/recipes/episode.mp3` is an original demo script synthesized with [Piper’s LJSpeech voice](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/high/MODEL_CARD). Caption cue times in `src/components/recipes/episode-clip.tsx` are relative to the start of the excerpt.

The Lyric Video uses a 21-second excerpt of [“Invisible Light” by Josh Woodward](https://commons.wikimedia.org/wiki/File:Josh_Woodward_-_The_Wake_-_07_-_Invisible_Light.ogg) ([CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/)). The Music Visualizer uses a 13.5-second excerpt of [“Haze” by Zutsuri](https://archive.org/details/jamendo-165035) ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)), from 2:25 in the album version on _Fen_. The Release Trailer uses a 14.6-second excerpt of [“Swansong” by Josh Woodward](https://commons.wikimedia.org/wiki/File:Josh_Woodward_-_Swansong.ogg) ([CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/)), from 3:16; its release card names Spotify and Apple Music, where Josh Woodward publishes his music. The Lo-fi Stream Background uses a 16-second excerpt of [“Lofi” by Caden Currie](https://commons.wikimedia.org/wiki/File:Lofi_by_Caden_Currie.mp3) ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)). All four recordings were trimmed, faded at the edges and re-encoded as MP3s; the lyric cues are relative to the trimmed file. They are line-level times read from the vocal’s level, and each line spreads its words over its duration.

The Work-in-progress Reel uses Banger’s demo track, which has no artist or title to show, and stops the music where its arrangement runs out. The rendered Canvas is silent and ignores the audio: Spotify loops it on its own clock, so it runs on time alone and hides the loop point in the sun’s glare. `bun run --filter @banger-elements/site recipes music-visualizer,release-teaser,release-reel,vertical-canvas` refreshes their previews. The Release Trailer remounts its scenes inside VHS on every frame, because VHS otherwise keeps the first capture of a WebGL child, so a separate `<Audio>` plays its soundtrack; expect it to render slower than the others. For a 720 × 1280 Canvas MP4, run this from `apps/studio`:

```bash
bunx remotion render src/fixtures/render-root.tsx VerticalCanvas canvas.mp4 --gl=angle --codec=h264 --muted
```
