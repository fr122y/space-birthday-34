# Game SVG assets

Original self-contained pixel-style SVG artwork. Geometry is aligned to integer pixels and each SVG uses `shape-rendering="crispEdges"`. Sprite backgrounds are transparent. Shared palette: midnight navy, cobalt/steel blues, cyan light, warm gold/orange, and restrained violet/pink for cosmic scenes and hazards. No text is baked into the art.

| Files | ViewBox | Purpose |
|---|---:|---|
| `rocket.svg` | 64×80 | Player ship, nose points upward |
| `drone.svg`, `scout.svg`, `turret.svg` | 64×64 | Regular enemies |
| `asteroid.svg` | 64×64 | Asteroid obstacle |
| `star.svg` | 32×32 | Star pickup or decoration |
| `pickup-spread.svg`, `pickup-rapid.svg`, `pickup-shield.svg`, `pickup-heal.svg`, `pickup-laser.svg` | 64×64 | Upgrade/recovery pickups |
| `debuff-slow.svg`, `debuff-jam.svg`, `debuff-gravity.svg` | 64×64 | Debuff pickups/hazards |
| `boss-1.svg` … `boss-5.svg` | 160×112 | Five distinct boss silhouettes |
| `bg-1.svg` … `bg-5.svg` | 960×1700 | Portrait stage backgrounds |
| `landing-scene.svg` | 1600×1000 | Greeting backdrop illustration |

Stage progression: `bg-1.svg` shows Earth orbit with the moon, orbital hardware, Ростов skyline and Don bridge; `bg-2.svg` shows a violet nebula and asteroid field; `bg-3.svg` features a blue gas giant and electric storm; `bg-4.svg` is an illuminated station corridor; `bg-5.svg` is a festive spiral galaxy with gold spark bursts, confetti, Earth horizon and Ростов skyline. Backdrops include subtle star twinkle and nebula drift, with compositions that remain legible when animation is disabled. `landing-scene.svg` combines a curved Earth, skyline, moon, rocket and galaxy while leaving the central sky open for greeting UI.

Build public asset URLs from Vite's base path, for example `const assetRoot = import.meta.env.BASE_URL + "assets/";` and then `assetRoot + "rocket.svg"`. This keeps paths working when GitHub Pages serves the game from a project subpath. Render sprite SVGs with `object-fit: contain`; choose game display sizes independently from intrinsic viewBoxes and preserve transparency. Bosses are wider than tall. Set stage images as `background-size: cover` over a dark fallback; the game may layer CSS parallax or scrolling over the image. Put greeting and start controls in accessible HTML over `landing-scene.svg`.
