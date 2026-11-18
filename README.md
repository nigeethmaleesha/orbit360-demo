# Orbit360 — Virtual Tour Demo

A polished, fully frontend-only 360° virtual tour proof-of-concept intended for client review. Built with HTML, CSS, JavaScript and [Pannellum](https://pannellum.org/) (open-source panorama viewer). **No backend, database, auth, or paid platform needed.**

## Features
- Drag/swipe to look around real equirectangular 360° panoramas.
- In-panorama navigation arrows linking scenes, with smooth scene transitions.
- Clickable scene list, illustrative route mini-map, zoom, fullscreen, auto-rotate, and guided slideshow.
- Responsive viewer for desktop and mobile.
- Mock **Tour Studio**: upload a local 2:1 360° JPEG/PNG/WebP panorama (max 40MB), place a navigation arrow at the current view direction, export a JSON config.
- **Project Brief** page with six client discovery questions and a clipboard-ready message.
- Deep links to example stops: `/#arrival`, `/#observatory`, `/#summit`.

## Important prototype limitations
- Sample scenes are **not** a real continuous road, and the map is a decorative route diagram, not accurate GPS geography.
- Uploaded files and changes exist only for that browser tab/session. They are **not** shared to other devices and are lost upon reload.
- Sharing copies the current URL, which only reproduces the seeded sample tour; it does not publish custom uploads or edits.
- The viewer and panorama photographs load from external CDN/origin URLs, so an internet connection is required.
- This is a 360° photo tour, **not** a reconstructed 3D mesh/digital twin.
- For production, self-host optimized tiled panoramas with proper licensing, persist media/configurations, handle user accounts, and implement a real map/floor-plan editor.

## Run locally

Since this is a static site, serve the folder with any static HTTP server (opening index.html directly with `file://` may restrict APIs):

```sh
npx serve .
```

Then visit the localhost URL shown in your terminal.

## Deploy on Vercel

1. Extract the ZIP or push the folder contents to GitHub.
2. In Vercel, **Add New → Project → Import repository**.
3. Set Framework Preset: **Other**. No build command or environment variables.
4. Root directory should contain `index.html`, `app.js`, `styles.css`, `vercel.json`.
5. Deploy; the site is a static project.

Alternatively, drag the directory into a Vercel deployment flow supported by your account or deploy using the Vercel CLI (`vercel deploy --prod`).

## Sample media and license

Demo imagery is served (not redistributed) from Pannellum's openly available example panoramas:
- https://pannellum.org/images/tocopilla.jpg
- https://pannellum.org/images/alma.jpg
- https://pannellum.org/images/lascar.jpg

The Pannellum **website image directory** is made available under **CC BY-SA 4.0**, according to https://github.com/mpetroff/pannellum.org . Credit: Pannellum example photography, from pannellum.org, used in an interactive prototype. License: https://creativecommons.org/licenses/by-sa/4.0/ . Pannellum's viewer engine is MIT-licensed (https://github.com/mpetroff/pannellum). Check the original image-level credits/conditions before commercial use. This is demonstrative use only; replace photos with client-owned, permission-cleared assets before production.

## Next step for a real product

Use a proper storage provider (e.g. Cloudflare R2), a DB to persist tours and image scenes, protected admin dashboard, multiresolution images/tiling, hotspot drag editing, and optionally GPS-linked route/floor-plan navigation. Scope should be confirmed after testing the client's original 360° files.
