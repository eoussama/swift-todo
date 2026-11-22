# Contributing to Swift TODO

Thank you for your interest in contributing to **Swift TODO**! We appreciate your help in making the project better.

Before you start contributing, please take a moment to review this guide, which outlines the process for contributing and the community guidelines we follow.

## Code of Conduct

We have a [Code of Conduct](CODE_OF_CONDUCT.md) that we expect all contributors to adhere to. Please read it and make sure you understand and follow it in all your interactions within our project.

## Getting Started

- If you are new to our project, please review our [README](README.md) for an overview of the project and how to get started.

- Check our [Issues](https://github.com/eoussama/swift-todo/issues) to find tasks that need assistance or to report any bugs or feature requests.

- For security vulnerabilities, do **not** open an issue. Follow the [Security Policy](SECURITY.md) instead.

## Development Setup

You need Node.js 24 or later and pnpm 12.

```bash
pnpm install
pnpm dev
```

`pnpm dev` opens a browser with the extension loaded and reloads it as you edit. Use `pnpm dev:edge` or `pnpm dev:firefox` for the other browsers.

Before opening a pull request, make sure every check passes:

```bash
pnpm check
```

It runs the dependency audit, lint, type check, unit tests (with coverage thresholds), the builds for all browsers, Mozilla's add-on linter on the Firefox build, the end-to-end tests and the website's tests, in that order, and stops at the first failure. The end-to-end and website tests need Playwright's Chromium: run `pnpm exec playwright install chromium` once.

All user-facing text lives in [`src/locales/en.yml`](src/locales/en.yml) and is read through `i18n.t()`, so please don't hardcode strings in components.

## How to Contribute

1. Fork the repository to your GitHub account.

2. Create a new branch for your contribution:

   ```bash
   git checkout -b feat/your-feature-name
   ```

3. Make your changes, keeping each commit focused on a single concern.

4. Commit your changes with a clear, descriptive message following [Conventional Commits](https://www.conventionalcommits.org):

   ```bash
   git commit -m "feat: add your feature"
   ```

5. Push the branch to your fork:

   ```bash
   git push origin feat/your-feature-name
   ```

6. Open a pull request against the `master` branch and fill out the pull request template.

## Pull Request Guidelines

- Link the issue your pull request addresses, if any.
- Keep pull requests small and focused; split unrelated changes into separate pull requests.
- Update the documentation when your change affects behavior or usage.
- Test your change in Chrome and Firefox at least.
- Be responsive to review feedback.
