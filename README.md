# Space Birthday 34

A browser based vertical space shooter celebrating 34 years of «Спецвузавтоматика».

## Published site

[Play Space Birthday 34](https://fr122y.github.io/space-birthday-34/). GitHub Actions builds and publishes the Vite `dist/` bundle on pushes to `main`.

## Approved brief

- Estimated target play time: 12–15 minutes; a full unassisted run has not been timed yet.
- Desktop and mobile support.
- Five boss encounters.
- Animated SVG space backgrounds.
- Visual direction: Russian pixel-art birthday screen with a rocket launch, starfield, bright cyan and yellow accents, and a Ростов-на-Дону skyline, based on the supplied [reference](https://ibb.co/DdGmD6g).
- Keep the company name exactly as provided: «Спецвузавтоматика».

## Development

```sh
npm install
npm run dev
```

Build with `npm run build`; preview a production build with `npm run preview`.

Run the desktop/mobile Playwright browser check with `npm run verify:browser`. `npm run verify:opening-wave` exercises 44 seconds of opening-wave play with active keyboard movement. The checks use the system Chromium executable and store screenshots in `/tmp/space-birthday-34-verification` by default.

After building, `npm run verify:pages` checks the production bundle from the `/space-birthday-34/` project path. After deployment, `npm run verify:live` smoke-checks the published desktop and mobile pages.
