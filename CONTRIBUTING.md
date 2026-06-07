# Contributing to Carbon SSH

This repository contains Carbon SSH's desktop application, React/Next.js frontend, and development tooling.

## Before you start

### General

- Search existing issues before opening a new bug report or feature request.
- Keep issues concise. Do not use AI to generate verbose descriptions or make paragraphs longer than necessary. Keep things short and to the point.
- If you want to work on an issue, comment on it and confirm that you are working on it before submitting a PR. This helps in avoiding duplicate work. 
- You don't need to ask for permission, just comment and start working on it but it is a good idea to confirm it with the maintainers to make sure the issue is relevant and your efforts are not wasted.

### AI Policy

- AI assistance is acceptable **if you know what you're doing, have thoroughly reviewed the generated code, and understand it**.
- **Do not** use automated bulk-PR tools (like OpenClaw) to spam the repository with PRs or issues. Doing so will result in a permanent ban.
- Using AI to reframe text or open issues is fine when required, but avoid generating unnecessarily long statements or paragraphs that don't add much value.
- The [agent/README.md](agent/README.md) provides more information about making your AI coding agent more effective when working with the codebase. Read it if you want to use an AI agent to help you with your contributions.

### Development & Building

We use `pnpm` for package management. **Do not** use `npm install` or `yarn install`, as it will cause issues with the lockfile.

- Install dependencies:
  ```bash
  pnpm install
  ```

  ---

- Run the app in development mode (starts both the Next.js server and Electron concurrently):
  ```bash
  pnpm dev
  ```
  or
  ```bash
  npm run dev
  ```
  ---
- Build the desktop executable version:
  ```bash
  pnpm build:electron
  ```
  This will open a CLI utility that guides you through building the app for your platform (Windows, macOS, or Linux). The built executable will be under `/release/dev` at the root.
- **Do not submit production builds** in pull requests. Only submit code changes and let the CI/CD pipeline handle production builds.

---

### Working with the `agent/` folder

The `agent/` folder contains tools and configuration files for AI coding agents.

- **Do**: Use the `agent/cache/` directory to store any markdown logs, temporary files, or agent-generated skills. It is ignored by git.
- **Do not**: Make changes to other folders or files inside the `agent/` directory unless you have a clear justification. Unapproved changes will be rejected.

For more information on how to use the tools in the `agent/` folder, please refer to the [agent/README.md](agent/README.md) file.

---

## Code style

- Follow standard JavaScript/TypeScript and React conventions.
- Prefer existing Carbon or Electron patterns over introducing new abstractions.
- Keep changes focused, minimal, and clean.
- Proofread surrounding code and context before submitting.

---

## Git style

### Clean commit messages

We use commit titles with a scope-first format, similar to Linux Kernel Style:

- `scope: short description`

Examples of good commit titles:

- `src/features/layout: add a ⌘+S shortcut to toggle vertical tabs`
- `src/features/terminal: fix stuck width when sidebar's collapsed`
- `deps: update xterm to 6.0.0`
- `electron/secure-store: encrypt credentials with biometric unlock`
- `src/lib/store: update connection state correctly`

Tips:

- Keep titles under 65 characters so they fit nicely within the 72-character limit after squash-merging with PR.
- Keep titles and descriptions meaningful. Do not use AI to write long, bloated commit messages that don't add real meaning. Minimal use of AI is fine, but make sure to review and edit the generated messages to keep them concise and informative.
- Concise and clear messages are more helpful for understanding the history and reasoning behind changes.

### Clean commit history

- Keep your branch history tidy before opening a PR.
- Use interactive rebase (`git rebase -i`) to squash fixups, fold minor bugs into the commits that introduced them, and keep history easy to read, bisect, and revert.
- Use `git commit --amend` for your latest commit, or `git commit --fixup` for older ones.

---

## Safety & Security

- **No Risky Changes**: Carbon SSH stores credentials and handles remote server connections. Avoid security-related alterations or changes that compromise credential encryption and storage. All security mechanisms must remain solid.

---

## Pull requests

Before opening a PR, ensure:

- The change is tied to an approved feature or confirmed bug.
- The branch builds, runs, and has been tested locally.
- The PR description is clear, concise, and includes screenshots or videos if there are UI changes.
- Your branch is rebased on `main`.

---

## Licensing

By contributing to Carbon SSH, you agree that your changes will be licensed under the repository's existing or future licensing terms.
