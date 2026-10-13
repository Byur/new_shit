# Map backend comparison: baked SVG plate vs MapLibre

Two compositions render the same film with different map renderers.

| Composition | Map | Registered as |
| --- | --- | --- |
| `CoffeeVideo` | baked Natural Earth plate in SVG | `CoffeeExplained` |
| `CoffeeVideoGL` | MapLibre GL JS + vector tiles | `CoffeeExplainedGL` |

`CoffeeVideoGL` is built to the `remotion-maps` **MapLibre** technique. It shares
narration, timing, camera keyframes, markers, highlights, captions and the
decision-chain header verbatim with `CoffeeVideo`. Only the map renderer differs,
so any visible difference is attributable to the map technique.

Both compositions are 1920×1080 @ 30fps, 14373 frames.

---

## 1. The only structural change the swap required

The acts place annotations from longitude/latitude:

```
Geography.tsx   6 calls   (tropics, equator, belt centre, frost line, frost point)
Regions.tsx     1 call    (camp labels)
```

Both previously called `project(view, lon, lat)`, importing the projection
directly from the SVG map component. That works only while there is exactly one
renderer.

The acts now take a `Projector` — `(lon, lat) => {x, y}` — and each composition
supplies its own:

```ts
// CoffeeVideo.tsx        — closed form, from the plate carree view transform
const svgProject = (lon, lat) => project(view, lon, lat);

// CoffeeVideoGL.tsx      — Web Mercator, matching what MapLibre draws
const glProject = makeMercatorProjector(view);
```

The refactor was verified to be behaviour-preserving: frame 7300 re-rendered
against the previously accepted QA still gives **mean absolute luma difference
0.0000, max 0** — pixel identical.

### Why the GL side needs its own projection at all

Asking the map instance (`map.project([lon, lat])`) would put the overlays one
frame behind the tiles, because the camera is only applied in an effect, after
render. So the GL backend reimplements Web Mercator in closed form.

That reintroduces precisely the failure mode the SVG backend cannot have: **two
projections that must be kept in agreement by hand** — the one the tiles are
drawn with, and the one the annotations are placed with. The SVG backend has one.

---

## 2. Defect found while building this: a silently missing highlight

`geo.ts` keys countries by zero-padded Natural Earth ids (`'076'`). `camera.ts`
wrote Brazil's cue as `'76'`. The SVG map guards the lookup:

```tsx
COUNTRIES[h.iso] ? (<path …/>) : null
```

so the miss drew **nothing at all** — no error, no gap, nothing out of place.
Brazil was un-highlighted in two acts (the altitude comparison in *Geography*,
the Latin America camp in *Regions*) in the already-delivered render.

Evidence at frame 6950, counting gold pixels in the map rectangle, before and
after, measured in both the lossless render and the encoded output:

| frame 6950 | lossless still | h264 output |
| --- | --- | --- |
| delivered `coffee-explained.mp4` | **0** | **0** |
| after fix | **770** | **124** |

Both columns move from nothing to something, which is the point. The 6× gap
between them is its own finding: the highlight is a thin 50 %-opacity fill over
dark land, and **h264 4:2:0 chroma subsampling removes most of it.** Measuring
only the encoded file would have made a real fix look like a marginal one — and,
more importantly, it means the encoded deliverable shows this highlight far more
weakly than the render does.

Fixed by normalising the key at the lookup (`isoKey`) rather than at the call
sites, so `'76'` and `'076'` both resolve; the cue was also corrected, and the GL
backend now throws loudly instead of skipping the layer.

**The delivered `out/coffee-explained.mp4` is now stale** — it predates this fix.
Re-render to pick it up.

---

## 3. What MapLibre buys

- **A real basemap, drawn by someone else.** Coastlines, country fills,
  boundaries, a graticule and country-name labels all come from the provider.
  For *drawing the base map*, `scripts/build-geo.mjs` (236 lines) and
  `src/coffee/geo.ts` (3380 lines, 230 KB) are not needed.
- **No API key.** MapLibre and the demo style are free.
- **Native label rendering** with glyph servers, halo and collision — something
  the SVG backend does not attempt at all. This is the clearest thing MapLibre
  gives that the baked plate cannot.
- **Native country highlighting** — but only because of the tile schema, not
  because of MapLibre. See the correction below.

### Correction: the baked data is still needed for country highlighting

An earlier draft of this document claimed the Natural Earth data becomes
unnecessary. That is **wrong**, and the tile schemas are why.

Country highlighting needs a polygon layer that can be filtered by ISO code.
Checked against the live schemas:

| Source | Country polygon layer? |
| --- | --- |
| `demotiles.maplibre.org` | **yes** — `countries` with `fid`, `NAME`, `ABBREV`, `ADM0_A3`, `CONTINENT` |
| CARTO `carto.streets/v1` | **no** — has `boundary` (lines, `admin_level`), `place` (points, `iso_a2`), `water`, `landcover`, `landuse`; land is just the background |
| OpenFreeMap `openmaptiles` | **no** — same story: `boundary`, `place`, `water`, `landcover`, no country fill |

Mainstream basemap schemas treat land as background and do not ship a filterable
country polygon layer. So "tint Brazil gold" is available for free **only on a
schema that happens to include country polygons**, which in practice means a
world-map demo schema like demotiles. On a production basemap you either upload
your own country polygons as a GeoJSON source — which puts you back to needing
the Natural Earth data — or you fake it with `boundary` lines and `place` labels.

The comparison is therefore not "no data pipeline vs a data pipeline". It is
"a data pipeline you control vs a data pipeline you rent, which covers the
basemap but not the highlighting".

## 4. What MapLibre costs

### Determinism ceremony

Every one of these is required by the technique, and none of it exists in the SVG
backend:

```
interactive: false                     attributionControl: false
fadeDuration: 0                        canvasContextAttributes: {preserveDrawingBuffer: true}
setWorkerUrl(from local dist, not unpkg)  delayRender/continueRender around load
delayRender/continueRender around EVERY frame, resolved on map 'idle'
no mapInstance.remove() in cleanup     --gl=angle --concurrency=1
```

The per-frame idle wait is load-bearing, not decorative: resolving before `idle`
lets Remotion capture the canvas mid-tile-load, which is the shimmer the
technique's moving-map guidance warns about. This backend therefore has no cleanup
that resolves the frame handle early.

### Render time, and why going offline did not fix it

**Going offline saved only ~19 %.** Full-length, same 14373 frames, same encoder:

| run | wall clock | what changed |
| --- | --- | --- |
| MapLibre, networked + unpkg worker | 18 m 37 s | — |
| MapLibre, through the caching proxy | 17 m 59 s | local worker |
| **MapLibre, fully offline** | **15 m 01 s** | **local tiles + worker** |
| SVG, for reference | 10 m 17 s | — |

So the network was worth about **3.5 minutes**. It is not the bottleneck, and
removing it leaves MapLibre at **1.46× the SVG render**.

Where the rest of the gap actually is — measured on both a parked-camera and a
camera-moving segment, at matched and at recommended concurrency:

| | parked (121 fr) | moving (120 fr) |
| --- | --- | --- |
| SVG, `--concurrency=6` | 5.96 s | 7.25 s |
| SVG, `--concurrency=1` | 8.40 s | 9.40 s |
| MapLibre, `--concurrency=1` | 11.73 s | 24.66 s |
| MapLibre, `--concurrency=3` | 7.80 s | 13.83 s |

Read at equal concurrency, the split is clear:

- **per-frame work**: at `--concurrency=1`, MapLibre is **1.40×** slower when the
  camera is parked and **2.62×** slower when it is moving. This is the tile
  loading and the per-frame `idle` round-trip, and it is inherent.
- **parallelism**: SVG gets ~1.3-1.4× from six concurrent tabs; MapLibre is
  pinned to one.

Both halves matter, and neither is about the network.

### The tempting optimisation, and why it is not available

The obvious move is to raise MapLibre's concurrency: `--concurrency=3` is
**1.50× faster parked and 1.78× faster moving**. If that were safe, the full film
would render in roughly the same time as the SVG version and this whole section
would collapse.

It is not safe. Rendering frames 6700-6740 as a **lossless PNG sequence** at
concurrency 1 and again at concurrency 3, **4 of 41 frames differ**:

| frame | differing pixels | max luma delta |
| --- | --- | --- |
| 6712 | 99306 | 5.8 |
| 6723 | 98795 | 21.3 |
| 6725 | 98433 | 24.0 |
| 6728 | 97650 | 3.6 |

The differences are not scattered noise. They form a **single tile-aligned
rectangle** (x 832-1344, y 128-512), and inside it concurrency 3 is uniformly
darker — 98429 pixels darker, **0 brighter**, mean RGB 84.7,73.9,43.6 against
77.4,65.4,40.3.

That is a tile captured in a different render state. It is exactly the race the
map technique's `--concurrency=1` rule exists to prevent, and it only appears on
camera-moving frames — the ones loading tiles.

So the rule is load-bearing, and the render time cannot be bought back this way.
The honest position: **the SVG plate is faster because it can be parallelised and
MapLibre cannot, and that is a property of the engines, not of the code.**

### Rendering through the SSR APIs

The GL film was also produced through Remotion's [SSR APIs](https://www.remotion.dev/docs/ssr-node)
— `bundle()` → `selectComposition()` → `renderMedia()` — instead of the CLI. The
script is `scripts/render-ssr.mjs` (`npm run render:ssr`).

**It produces an equivalent video at the same cost.** Frame 6700-6819 rendered
back to back, same options:

| | wall clock |
| --- | --- |
| CLI | 26.3 s |
| SSR | 27.1 s |

The same engine drives both; SSR is a different entry point, not a faster or
slower renderer. (A 3 % difference on a 26 s run is run-to-run noise — the two
differ by 0 s or 0.06 mean luma on 5 of 6 sampled frames, which is the h264
encoding jitter documented below.)

The full SSR render: **14373 frames, 1920×1080, 479.146667 s**, `h264` /
`yuvj420p` / `aac` 48 kHz stereo — identical metadata to the CLI output, in
**15 m 29 s** (bundle 7.7 s + render 921.8 s).

One thing genuinely does change. **The Node APIs do not read
`remotion.config.ts`**, so every setting in it has to be re-applied by hand:

| `remotion.config.ts` | SSR equivalent |
| --- | --- |
| `Config.setRspack(true)` | `bundle({rspack: true})` |
| `Config.overrideBundlerConfig(enableTailwind)` | `bundle({bundlerOverride: enableTailwind})` |
| `Config.setVideoImageFormat("jpeg")` | `renderMedia({imageFormat: 'jpeg'})` |
| `Config.setOverwriteOutput(true)` | `renderMedia({overwrite: true})` |
| `--gl=angle`, `--timeout=180000` | `chromiumOptions: {gl}`, `timeoutInMilliseconds` |

That is the real cost of the SSR route: the config file stops being the single
source of truth for how this project renders, and the two can drift.

### The frame-0 failure: a hidden map cannot return null

The first full-length render died on **frame 0** with

```
A delayRender() "MapLibre map load" was called but not cleared after 178000ms
```

The cause is a collision between the film's own architecture and how a WebGL map
owns a DOM node.

`mapOpacityAt(0)` is **0** — the map is invisible for the opening of the hook. The
component mirrored the SVG map's early-out:

```tsx
if (opacity <= 0.005) return null;
```

and the boot handle was created in a `useState` initialiser, which runs before
that early return. Returning `null` means there is no container node, so the mount
effect bailed out — and because its dependency array was empty it **never ran
again**. The map was never constructed, nothing ever cleared the handle, and the
render timed out.

This never showed up in stills (frames 900+) or in the 341-frame segment
(6700–7040). **It only exists at frame 0 and only in a full-length render.**

The fix is not just to move the handle. A MapLibre map instance is bound to a DOM
node, so the container now stays mounted for the whole film and visibility is
expressed as `opacity: 0`:

```tsx
/* the SVG map is stateless and can safely return null when invisible;
   this one cannot, and an early return would orphan the map and its handle */
const visible = opacity > 0.005;
```

This is the film's own stated principle — *the map is never unmounted* — being
enforced by the engine rather than by choice. The SVG backend can honor it because
it is a pure function of the view; the GL backend has to, because it owns state.

### Exactly what the render fetches, and why it is not baked

I had been describing the render-time network dependency generically ("style,
glyphs, tiles"). That was not good enough to decide whether to remove it, so I put
a caching proxy in front of the provider and rendered the whole film through it.
Every URL the GL backend asks for, for all 14373 frames:

| kind | count | size |
| --- | --- | --- |
| vector tiles, **z1–z4 only** | **60** | 1.1 MB |
| glyph range, `Open Sans Semibold/0-255` (basic Latin) | **1** | 76 KB |
| style JSON + TileJSON | 2 | 80 KB |
| **total** | **63** | **1.3 MB** |

That is the whole basemap for a 479-second film. The camera never exceeds zoom
~4.75, and the provider's data is coarse Natural Earth, so 60 tiles cover it.

1.3 MB is small enough to bake into the repo, so I did: a caching proxy collected
the set, a build script wrote it into `public/basemap/`, and the map loaded a
local style with the worker copied out of `node_modules/maplibre-gl/dist/`.
Verified by stopping the proxy and rendering — zero 404s, and every sampled frame
bit-identical to the networked render.

**Then I backed the basemap part out again.** It saved 3 m 36 s of an 18 m 37 s
render, about **19 %**, because the network was never the bottleneck — see
*Render time* above. Against that it added two scripts, 1.3 MB of committed data
that has to be kept in sync with a style we do not own, a runtime style-rewriting
layer, and four separate ways to fail silently. Not worth it.

**What was kept** is the local worker: `public/maplibre-gl-worker.mjs` is
committed and loaded through `staticFile()`. That is one file and one line, and it
removes unpkg.com from the render path — a different question from offline, and
one where the trade is clearly worth it.

**What the attempt did buy** is the four findings below. Each one produced a
silently *wrong* map rather than an error, and none of them are documented
anywhere I could find.

### Four traps, if you ever do try baking this

Each of these produced a *silently wrong* map rather than an error, which is why
they are worth writing down.

**1. Relative URLs in the style do not resolve against the style.** Writing
`"url": "tiles.json"` looked right. MapLibre resolved it against the **origin**,
not the style's directory, so it requested `/tiles.json`.

**2. `staticFile()` prefixes a build hash.** The style is served from
`/<hash>/basemap/style.json`, so absolute paths like `/basemap/tiles.json` inside
it are wrong too — they 404. The bake cannot know the hash, so the style is
fetched at runtime and its URLs rebuilt through `staticFile()`, which is the only
thing that knows it.

When the tile source fails, MapLibre does not report a broken map. It renders the
style's background layer — **bare ocean, no land** — and looks like a styling
problem. That is what the first two attempts produced, and it was only caught by
diffing frames against the networked render: mean luma 22.1 vs 45.6 over the same
region.

**3. `remotion render` serves `public/` from a cached bundle**, so newly added
basemap files are invisible until the bundle is rebuilt. Clearing
`$TMPDIR/remotion-webpack-bundle-*` is what actually picked them up;
`--bundle-cache=false` and touching a source file did not.

**4. Percent-encoded paths must be decoded for the filesystem.** The cache mirrors
URL paths, so the glyph directory arrives as `Open%20Sans%20Semibold`. Written to
disk literally, the server never matches the decoded path it looks up.

### Operational fragility

- **The whole toolchain needs telling that this needs a GPU.** `renderStill`
  without `chromiumOptions.gl` fails with `GPUInitializationError: WebGL2 is
  required`. The SVG compositions never needed this, so the QA harness had to
  grow a `--gl` flag before it could run on this backend at all.
- **Default `delayRender` timeout is 30 s and is not enough.** A first attempt
  failed with `Timed out after 30000ms while setting up the headless browser`
  purely because the worker and style had not arrived. `--timeout=120000` is
  needed.
- **Network at render time**: the style JSON, glyph PBFs and 1.3 MB of tiles all
  come from `demotiles.maplibre.org`. Baking them was tried and reverted — 19 %
  of render time was not worth the upkeep. The unpkg dependency *was* removed;
  the worker is local now.
- **Browser diagnostics are hard to read.** `console.log` from the page is not
  forwarded by the CLI, and `delayRender` labels only surface for the root
  component phase. The working channel was to **throw an `Error`** containing the
  values, which Remotion prints. That is how `querySourceFeatures` returning 290
  country features was confirmed.

### Unused dependency

`@turf/turf` was installed because the technique calls for it. This film has no
great-circle routes, distances or line slicing, so Turf was never used and has
been removed. `maplibre-gl@6.14.0` is the only dependency added.

## 5. The visible difference: palette, and how it was resolved

### As shipped by the technique, the style is unusable here

The demo style is a light, high-key pastel basemap (`background: #D8F2FF`, pastel
country fills). Measured over the map rectangle at frame 7300:

| | mean RGB | distinct 5-bit colour buckets |
| --- | --- | --- |
| SVG (film palette: ocean `#150F0A`, land `#4E3E2C`) | **36, 27, 18** | 158 |
| MapLibre, demo style untouched | **108, 114, 109** | 447 |

It is not close. The map goes from the darkest element in the frame to the
brightest, and the gold origin dots and gold highlights lose most of their
contrast against it.

### The obvious fix does not work

Switching to a dark style was the first idea. Both widely used free dark styles
were checked against the film:

| style | background | water | land |
| --- | --- | --- | --- |
| CARTO dark-matter | `#0e0e0e` (L 14) | `#2C353C` (L 53) | background |
| OpenFreeMap dark | `rgb(12,12,12)` (L 12) | `rgb(27,27,29)` (L 27) | background |
| **this film** | ocean `#150F0A` (L 21) | **the ocean is the darkest thing** | `#4E3E2C` (L 64) |

Both dark styles follow the dark-mode convention that **water is lighter than
land**. This film is the opposite: the ocean is the darkest element and land sits
above it, which is what makes the continents read as raised on a dark page. A
dark style would have given the right overall luminance and reversed the
land/water relationship.

They also both lack a country polygon layer (§3), so neither can carry the
highlighting.

### What was actually done

The provider's own layers were restyled in place, which is the documented
MapLibre way and what a production film would do with a licensed style:

```ts
const BASEMAP_RECOLOR: Array<[string, string, string | number]> = [
  ['background',          'background-color', theme.ocean],
  ['countries-fill',      'fill-color',       theme.land],
  ['coastline',           'line-color',       theme.landEdge],
  ['countries-boundary',  'line-color',       theme.landEdge],
  ['geolines',            'line-color',       theme.beltEdge],
  ['countries-label',     'text-color',       theme.textDim],
  … 17 overrides in total
];
```

Two things were deliberately left alone. **Country name labels stay on**, because
real label placement with collision and halo is the clearest thing MapLibre gives
that the baked plate does not. And **the tile data is untouched** — the coastline
is still the provider's, so this remains a genuine basemap rather than a redrawn
one.

Result at frame 7300:

| | mean RGB | distinct colour buckets |
| --- | --- | --- |
| SVG | 36, 27, 18 | 158 |
| MapLibre, restyled | **35, 26, 18** | **181** |

The palettes now match to within 1/255 on the mean, and MapLibre carries **more**
colour detail than the baked plate — real coastline vertices plus placed labels.

The cost is a **visible attribution** inside the map, which the SVG plate does not
need because it owns its data (Natural Earth is public domain).

### Whole-film check

One frame proves little, so both full renders were measured on 25 frames spread
across all seven acts:

| | mean over 25 frames | worst frame |
| --- | --- | --- |
| mean luma difference | **0.19 / 255** | 0.78 / 255 (frame 10247) |
| ink-coverage difference | ≈0.2 percentage points | 0.6 pp |

Both full renders are 14373 frames, 1920×1080, 30 fps, and **479.146667 s** — the
same to the millisecond. Within the frame budget the two are a drop-in swap: the
restyle removed the exposure difference that made the unmodified style unusable.

What is *not* the same is the map area itself. Same frame, same camera, different
projection and different coastline data; that difference is what the comparison
images in `output/coffee-explained/map-backend/` exist to show.

### A QA note that came out of this: h264 is not bit-deterministic

While checking whether the offline render matched the networked one, four of six
sampled timestamps in the two encoded MP4s were **bit-identical** and two were
not (mean luma 0.06 and 0.14, max 16-18).

The lossless frames at those exact frames were **bit-identical, 0 differing pixels
out of 518400**. So the render is fully deterministic and the difference is
introduced by the h264 encoder, whose threading makes it non-reproducible across
runs.

Two consequences:

- **A render cannot be verified by comparing encoded files.** Frame-level QA has
  to compare lossless frames.
- The basemap palette check earlier in this document was done on decoded MP4
  frames and reported a 0.14 mean difference there — which is now explained as
  encoder noise, not a real difference.

The same effect is much larger on thin, semi-transparent detail: the Brazil
highlight measured 770 gold pixels in the lossless render and 124 in the encoded
output. **The delivered MP4 shows that highlight far more weakly than the render
does**, and only a lossless comparison reveals it.

## 6. The visible difference: projection

The technique's Web Mercator replaces the plate carrée plate. Both keep parallels
horizontal, so "which is nearer the equator" still reads. What changes is the
**vertical scale**, which is now non-uniform.

At the full-world view (latitude window ±45°, map height 506 px), computed
analytically:

| latitude | plate carrée y | Web Mercator y | delta |
| --- | --- | --- | --- |
| +23.5° (Tropic of Cancer) | 120.9 px | 131.8 px | **+10.9 px** |
| 0° (equator) | 253.0 px | 253.0 px | 0.0 px |
| −23.5° (Tropic of Capricorn) | 385.1 px | 374.2 px | **−10.9 px** |

So the coffee belt — 264.2 px tall in plate carrée — becomes 242.4 px, **8.3 %
narrower**, and Mercator stretches the vertical scale by 1.09× at the tropics and
1.414× at the window edge.

A 10.9 px shift is small on a 506 px map, but the tropics band is the opening
image of act three and the belt's height is part of what the act is asserting.
The projection was chosen for this film precisely so that the band reads at true
relative scale across the window.

## 7. Shimmer check

The technique requires rendering a real MP4 and inspecting for shimmer before
accepting a live per-frame camera. 24 consecutive frames of each segment, map
region only:

| | mean frame-to-frame Δluma | SD | range |
| --- | --- | --- | --- |
| SVG | 0.48 | 0.27 | 0.07–0.93 |
| MapLibre | 2.07 | 0.59 | 0.47–2.80 |

The GL deltas are larger because the pastel basemap carries far more detail and
contrast, so a moving camera changes more pixels. The important part is the
**shape**: the GL sequence rises and falls smoothly with the camera easing
(`2.7 2.5 2.5 2.8 2.4 2.2 2.1 1.8 1.6 0.9 0.5 1.2 1.4 2.0 …`) with no
high-frequency jitter. **No shimmer observed.** The live per-frame `jumpTo` is
viable here, contrary to the fixed-plate default.

---

## Verdict

For *this* film the baked SVG plate is still the better backend, but the reason
is no longer the palette — that turned out to be fixable in 17 lines of paint
overrides:

- it is **1.46× faster to render** end to end, and the cause is structural:
  it parallelises across six tabs, MapLibre cannot parallelise at all
- it keeps the coffee belt at **true relative scale**, which is what act three
  asserts (Mercator narrows it 8.3 %)
- it has **one projection** instead of two that must be kept in agreement by hand
- highlighting a country is a **local lookup**, not a property you have to hope
  the rented tile schema provides
- it is ~380 fewer lines and one fewer runtime dependency
- it has no attribution obligation, because it owns its data

MapLibre wins on things this film does not need or does not use well:

- **placed, collided, haloed country labels** — genuinely beyond the baked plate,
  and visible in the result
- **coastline detail** the 1:110m bake throws away (230 KB of simplified paths vs
  a vector tile source)
- satellite imagery, terrain, hillshade, street-level detail, 3D — none used here

The honest summary: on a dark restyle the two are **visually very close**
(mean RGB 36,27,18 vs 35,26,18). What separates them is not how they look but what
they cost to keep looking that way — a render that cannot be parallelised, a baked
tree that has to be kept in sync with a style you do not own, GPU dependence, and a
projection that has to be mirrored by hand.

I did try removing the network dependency entirely. It came back out: 1.3 MB of
committed basemap bought a 19 % shorter render, because the network was never
where the time went. The cost of this backend is time, output size, GPU
dependence, and a rented style — and only the first two have any lever on them.

## Reproduce

The render needs network access: the style, glyphs and tiles come from
`demotiles.maplibre.org`. The one thing that is local is the worker
(`public/maplibre-gl-worker.mjs`), which is committed.

If you ever change `public/`, the headless bundle must be rebuilt or the new files
are invisible to the render — this cost me an hour:

```bash
rm -rf "$TMPDIR"remotion-webpack-bundle-*
```

Render any composition:

```bash
# the MapLibre variant, headless — needs --gl
npx remotion render CoffeeExplainedGL out/gl.mp4 \
  --gl=angle --concurrency=1 --timeout=180000

# the same render through the SSR APIs (bundle -> selectComposition -> renderMedia)
npm run render:ssr -- CoffeeExplainedGL out/gl.mp4 \
  --gl=angle --concurrency=1 --timeout=180000

# the SVG variant
npx remotion render CoffeeExplained out/svg.mp4 --concurrency=6

# frame-level QA (add --gl for the MapLibre composition)
node scripts/qa-frames.mjs --plan scripts/qa-plan-gl.json

# side-by-side composites (top = SVG, bottom = MapLibre)
node scripts/compare-map-backends.mjs 900 6300 7300 11850
```

Artifacts in `output/coffee-explained/map-backend/`:

- `coffee-explained-svg.mp4`, `coffee-explained-gl.mp4` — both 14373 frames,
  1920×1080, 30 fps, 479.146667 s
- `map-{900,6300,7300,11850}.png` — map rectangle, SVG above, MapLibre below
- `svg-segment.mp4`, `gl-segment.mp4` — frames 6700–7040, identical length
  (341 frames, 1920×1080, 30 fps)
