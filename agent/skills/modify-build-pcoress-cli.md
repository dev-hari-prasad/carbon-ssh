# Modify Build Process CLI

## Purpose

Use this skill whenever changing the Electron application build process.

## Rules

- `scripts/build-electron.mjs` is the single entry point for every Electron build.
- The CLI owns platform selection, development or production mode, packaging, release output routing, error propagation, and temporary build-directory cleanup.
- Extend or modify the existing CLI when build behavior changes.
- Do not add, modify, or expose npm scripts for build-process behavior.
- Do not create alternative build entry points.
- Internal helper files may only be changed when they are invoked and controlled by `scripts/build-electron.mjs`.
