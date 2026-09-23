# Contributing to Plax

Thanks for helping make Plax better. This project is maintained by
[PreCog Security](https://github.com/PreCogSecurity) and follows a few simple
rules so every change stays reviewable, testable, and shippable.

## Getting started

```sh
npm install
npm test
npm run lint
```

The test suite runs against jsdom and must stay green before any change is
merged. The linter (ESLint with `eslint:recommended`) must pass with zero
errors.

## What we look for

- **Tests ship with behavior.** Every bug fix or feature lands with a test in
  `test/plax.test.js` that pins the new behavior. If a change cannot be
  tested, say why in the PR description.
- **Small, focused commits.** Keep each fix or feature in its own commit (or
  small PR). Avoid bulk commits that mix formatting, refactors, and features —
  they make review harder and history harder to mine.
- **No new runtime dependencies.** Plax is a zero-dependency browser plugin.
  If you believe a runtime dependency is unavoidable, open an issue first and
  make the case.
- **Backwards compatibility.** Plax supports jQuery 1.8+ and must remain a
  single-file, drop-in `<script>` include. Do not introduce a build step or
  module system without a design discussion first.

## Security

Plax runs in the browser and processes DOM data attributes and user-supplied
options. Treat all of those as untrusted input:

- Never let option values reach `innerHTML`, `eval`, or similar sinks.
- Keep the global namespace clean: no implicit globals, no prototype
  pollution.
- If you find a security issue, report it privately to the maintainers before
  opening a public issue.

## Releasing

1. Bump the version in `package.json` and the header comment in `js/plax.js`.
2. Add an entry to `CHANGELOG.md`.
3. Run `npm test` and `npm run lint` one final time.
4. Tag the release and push the tag.