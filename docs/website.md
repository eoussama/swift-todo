# Website

[swift-todo.ouss.es](https://swift-todo.ouss.es) is built from [`site/`](../site/): a single page and a privacy policy page, written in Svelte like the extension and rendered to HTML at build time, so they read fine without JavaScript. The "Just type it" demo runs the extension's own date parser from `src/lib/time`, and the images come from [`showcase/`](../showcase/showcase.md) and `branding/`.

- `pnpm site` serves it with hot reload.
- `pnpm site:build` builds it into `.output/site` (see `site/build.ts`).
- `pnpm test:site` builds it and runs its tests in `tests/site` (rendering without JavaScript, the demo, the skins, the trailer, accessibility in light and dark, small screens, the privacy page). `pnpm check` runs them too.

The privacy page at `/privacy/` is made from [PRIVACY.md](../PRIVACY.md), so edit the policy there. That page's URL is the one the stores link to.

## Store links

Until the store listings are live, the install buttons point at the latest GitHub release and the page explains how to load the zip. Once a listing is up, paste its URL into `STORES` in [`site/src/links.ts`](../site/src/links.ts): its buttons then say "Add to Chrome" (or Edge, or Firefox) and go to the store, and the explanation goes away when all three are set.

## Deploying

The [website workflow](../.github/workflows/website.yml) builds, tests and deploys the site to GitHub Pages whenever a `v*` tag is pushed, and can be run by hand from the Actions tab (*Website* → *Run workflow*).

### One-time setup

1. **Pages source**: in the repository's *Settings* → *Pages*, set *Source* to **GitHub Actions**.
2. **Allow tags to deploy**: GitHub creates a `github-pages` environment that only accepts deployments from the default branch. In *Settings* → *Environments* → `github-pages` → *Deployment branches and tags*, add a tag rule for `v*` (and keep `master`, for runs started by hand).
3. **Domain**: at the DNS provider for `ouss.es`, add a `CNAME` record for `swift-todo` pointing to `eoussama.github.io`.
4. **Custom domain**: in *Settings* → *Pages*, enter `swift-todo.ouss.es` as the custom domain, wait for the DNS check, then turn on **Enforce HTTPS**. With a workflow deployment, GitHub keeps the domain in the settings, so the site needs no `CNAME` file.
