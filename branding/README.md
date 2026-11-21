# Branding

Store images for the Chrome Web Store, Microsoft Edge Add-ons and Firefox Add-ons (AMO). The text that goes with them is in [docs/store-listing.md](../docs/store-listing.md).

They're drawn from the icon (`src/assets/icon.svg`) and the screenshots in [showcase/](../showcase/showcase.md), in the Notepad skin's colors and fonts. To make them again, run `pnpm showcase` if the app changed, then `pnpm branding`.

## What goes where

| File | Size | Chrome | Edge | Firefox |
| --- | --- | --- | --- | --- |
| `icons/icon-128.png` | 128 × 128 | Store icon | – | Listing icon, if asked |
| `icons/icon-300.png` | 300 × 300 | – | Extension logo | – |
| `icons/icon-512.png` | 512 × 512 | – | – | – (for the README, social posts and anywhere else) |
| `screenshots/1-overview.png` | 1280 × 800 | Screenshot 1 | Screenshot 1 | Screenshot 1 |
| `screenshots/2-natural-language.png` | 1280 × 800 | Screenshot 2 | Screenshot 2 | Screenshot 2 |
| `screenshots/3-today-focus.png` | 1280 × 800 | Screenshot 3 | Screenshot 3 | Screenshot 3 |
| `screenshots/4-skins.png` | 1280 × 800 | Screenshot 4 | Screenshot 4 | Screenshot 4 |
| `screenshots/5-lists-sync.png` | 1280 × 800 | Screenshot 5 | Screenshot 5 | Screenshot 5 |
| `promo/promo-small-440x280.png` | 440 × 280 | Small promo tile | Small promotional tile | – |
| `promo/promo-marquee-1400x560.png` | 1400 × 560 | Marquee promo tile | Large promotional tile | – |

## Store rules these follow

- **Chrome**: a 128 × 128 icon with 96 × 96 of art and a transparent border; 1 to 5 screenshots at 1280 × 800; a 440 × 280 small promo tile (without one, the extension is listed after those that have one); and a 1400 × 560 marquee, needed to be featured. See [Supplying images](https://developer.chrome.com/docs/webstore/images).
- **Edge**: a square logo, 300 × 300 recommended; up to 6 screenshots at 1280 × 800 or 640 × 480; and optional 440 × 280 and 1400 × 560 (PNG) promotional tiles. See [Publish a Microsoft Edge extension](https://learn.microsoft.com/microsoft-edge/extensions/publish/publish-extension).
- **Firefox**: the icon comes from the add-on itself; screenshots work best at 1280 × 800, and AMO has no promo tiles.
