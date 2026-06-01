# Contributing to Carbon SSH

Thank you for your interest in contributing to Carbon SSH! To maintain code quality and secure development, please follow these guidelines.

## Getting Started

1. **Fork the Repository**: Always fork the repository to your own account first.
2. **Clone and Install**:
   - Clone your fork locally.
   - Use `pnpm` for package management. Run:
     ```bash
     pnpm install
     ```
   - > [!IMPORTANT]
     > **Avoid using `npm` or `yarn`**. Do NOT delete or modify package lock files (like `pnpm-lock.yaml`) unless you are explicitly upgrading dependencies.

## Branching Guidelines

- **Branching is a must**: Do not submit pull requests directly from your `main` or `master` branch.
- **Branch Naming**: It is highly suggested to prefix your branch names with legends describing your change. For example:
  - `feature/your-feature-name`
  - `bug/your-bugfix-name`
  - `ui/your-interface-change`
  - `chore/your-task-name`

## Safety & Security

- > [!CAUTION]
  > **No Risky Security Changes**: Avoid making any security-related alterations or introducing changes that create potential security risks. All authentication, credential encryption, and storage mechanisms must remain fully secure.

---

## Codebase Folder Structure

Here is a quick high-level overview of the folder structure to help you navigate the codebase:

```
├── electron/              # Electron main process, IPC handlers, secure store integrations
├── src/                   # React frontend application (Next.js App Router)
│   ├── app/               # Next.js pages, layouts, and API routes
│   ├── components/        # Shared presentation components (Onboarding, Kbd, etc.)
│   ├── config/            # Central configurations (themes, fonts, titlebar)
│   ├── features/          # Feature-based module components (terminal, settings modal)
│   ├── hooks/             # Custom React hooks
│   └── lib/               # App state management (store.ts), API clients, storage utils
├── public/                # Static assets, branding logos, icons
└── package.json           # Scripts, dependencies, and builder config
```

## Onboarding Agent & Assistant Prompt

Copy the prompt below to bootstrap your AI coding agent/tool (or paste it into standalone chat assistants like ChatGPT, Claude, or Gemini) to get an interactive, context-aware walkthrough of this codebase!

```text
I am a new contributor onboarding to Carbon SSH. Please analyze the codebase and provide an architectural walkthrough. In particular, explain:
1. How the React/Next.js frontend inside `src/` interfaces with the Electron main process in `electron/` using IPC channels.
2. How global states, active tabs, and SSH connection sessions are coordinated in `src/lib/store.ts`.
3. The configuration layout for custom theme colors, fonts, and terminal styling.
4. The React entry points for the onboarding step flow.

---
[System Fallback Instruction for Standalone Chat Assistants]:
If you are a standalone chat AI assistant (such as ChatGPT, Claude, or Gemini) without direct local workspace access, you MUST first browse the official repository at https://github.com/dev-hari-prasad/carbon-ssh to properly explore the repository files before responding. If you are unable to browse the repository or access the source code, please explicitly inform the user that you require codebase/workspace access to provide an accurate walkthrough.
```
