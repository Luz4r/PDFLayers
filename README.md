# PDF Layer Toggler (web)

A browser port of `source/toggle_layers_gui.py`, built to run on an iPhone.

Hiding a layer sets its default visibility to OFF in the PDF's default optional
content configuration — the same non-destructive edit the Python version makes.
The content stays in the file and any viewer can switch it back on.

Everything runs in the browser. The PDF is read into memory, edited, and handed
straight back to you; nothing is uploaded, and there is no server component.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup |
| `styles.css` | Styling, incl. dark mode and iPhone safe areas |
| `ocg.js` | Layer reading/editing — port of `toggle_layers.py` |
| `app.js` | UI wiring — port of `toggle_layers_gui.py` |
| `pdf-lib.min.js` | [pdf-lib](https://pdf-lib.js.org/) 1.17.1, vendored (no CDN) |
| `sw.js` | Service worker; precaches the app shell for offline use |
| `manifest.webmanifest` | Home-screen name, icon, standalone display |
| `icon-*.png` | App icons |

## Hosting on GitHub Pages

Pages can only publish from the repo root or a `/docs` folder, so pick one:

**Option A — dedicated repo (simplest).** Put these files at the root of a new
repo, then Settings → Pages → Deploy from a branch → `main` / `/ (root)`.

**Option B — keep them inside this project.** Rename this folder to `docs`,
push, then Settings → Pages → Deploy from a branch → `main` / `/docs`.

All paths are relative, so the app works from a project subpath
(`you.github.io/repo/`) as well as a domain root.

HTTPS matters: the service worker and the share sheet both require a secure
context. GitHub Pages gives you that automatically.

## On the iPhone

1. Open the Pages URL in Safari.
2. Share → **Add to Home Screen**. It then launches without browser chrome.
3. Open it once while online; after that it works with no connection.

**Open PDF** uses the native Files/iCloud picker. **Save** goes through the iOS
share sheet, so you can pick *Save to Files*, AirDrop it, or send it straight to
*Print*. On desktop browsers without the share sheet it falls back to an
ordinary download. Output is named `<original>_layers.pdf`, matching the Python
version.

## Shipping an update

Edit the files, then bump `CACHE` in `sw.js` (`pdf-layers-v1` → `-v2`) and push.
Without the bump, devices that already cached the app keep serving the old copy.

## Notes

- Saved with `useObjectStreams: false`, which keeps the output readable by older
  viewers and print shops.
- Layers are numbered in the list. Some patterns repeat layer names across pages
  (e.g. one `XL` per page), so the number is what tells them apart.
- Files with `/BaseState /OFF` are handled: the app reads visibility from `/ON`
  and keeps that array consistent when saving.
