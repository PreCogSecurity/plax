# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-09-22

### Security & hardening

- Eliminated all implicit globals (`pos`, `x`, `y`, `values`, `newX`, `newY`,
  `newZ`, `layer`) that leaked into the global namespace and could collide
  with other scripts on the page.
- `$.fn.plaxify` now iterates `params` with `hasOwnProperty`, so a polluted
  `Object.prototype` cannot inject keys into layer configuration.
- `enable()` no longer clobbers other scripts' `window.ondeviceorientation`
  handlers; it now uses `addEventListener`/`removeEventListener` with a
  tracked handler.
- The plugin factory no longer throws a `ReferenceError` when neither
  `jQuery` nor `ender` is present.
- `get3dTranslation` and `supports3dTransform` now guard against malformed
  transform strings and a missing `document.body` instead of throwing.

### Bug fixes

- `disable()` now unbinds the `mousemove.plax` handler from the element it
  was actually bound to (`activityTarget`), not always `document`. Previously
  `disable()` was a no-op when an `activityTarget` was in use.
- Repeated `enable()` calls no longer stack duplicate `mousemove` handlers;
  a single `disable()` now fully stops parallaxing.
- `enable()` with no registered layers no longer throws a `TypeError` in the
  render loop.
- The initial `transform` written by `plaxify()` was invalid CSS
  (`0,0,0px`); it is now a proper `translate3d(0px,0px,0px)`.
- `useTransform` is now resolved per layer at `plaxify()` time instead of
  being read from a module-global that the last `plaxify()` call could
  overwrite.
- Motion baseline (`motionStartX`/`motionStartY`) is recalibrated on every
  `enable()`.
- `enable({ gyroRange })` without an `activityTarget` now correctly binds to
  `document.body` instead of an empty jQuery set.

### Behavior notes

- When both a data attribute and a `plaxify()` param are supplied for the
  same option, the element-specific data attribute now wins (previously a
  falsy data value such as `data-invert="false"` was silently overridden).
- Background layers whose `background-position` cannot be parsed are now
  reported via `console.warn` (with the offending element) instead of failing
  silently; the layer is left unregistered as before.

### Engineering

- Added a Jest + jsdom test suite (`npm test`) covering `plaxify`,
  `enable`/`disable`, data-attribute parsing, background layers, and state
  transitions.
- Added ESLint configuration (`npm run lint`) with `eslint:recommended`.
- Added a GitHub Actions CI workflow that installs, lints, tests, and audits
  dependencies on every push and pull request.
- Committed `package-lock.json` for reproducible installs.
- Added `CONTRIBUTING.md` and this changelog.

## [1.4.1] - 2015-07-09

- Last upstream release (Cameron McEfee). See the git history for details.