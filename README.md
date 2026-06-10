# <img src="./public/logo/Carbon logo light.svg" alt="Carbon Logo" height="42" align="center" /> Carbon SSH

> [!WARNING]
> **Early Alpha**: Carbon SSH is currently in its early alpha stages of development. Features are active, but expect occasional bugs, rough edges, and changes.

Carbon is a modern, fast, and easy-to-use SSH connection manager designed to streamline how you connect and interact with your remote servers.

## Features

- **Secure by Design**: Encrypted credentials stored locally.
- **Fast & Fluid**: Custom workspace navigation, layout splits, and a highly responsive terminal interface.
- **Command Bangs**: Custom quick command aliases for executing repeated remote tasks effortlessly.
- **Biometric Integration**: Unlock your workspace securely using Passkeys or Windows Hello/Touch ID.

## Building the app and working with the codebase

### To get started with development:

- Install dependencies with:

  ```bash
  pnpm install
  ```

> [!Note]
> If you do not have `pnpm` installed, you can install it globally using npm:

  ```bash
  npm install -g pnpm
  ```

> [!WARNING]
> Do not use `npm install` or `yarn install` as it may cause issues with the lock file. Always use `pnpm` to keep the dependency tree consistent.

- **Build the app in development mode using**:
  ```bash
  pnpm dev
  ```
  or
  ```bash
  npm run dev
  ```
  This will start the Next.js development server and the Electron app concurrently and lunch the desktop application.

### To build the desktop executable version of the app:

- Run this command in your terminal to build the Electron app:

  ```bash
  pnpm build:electron
  ```

  or

  ```bash
  npm run build:electron
  ```

  This will open a cli utlity that will guide you through the process of building the app for your platform (Windows, macOS, or Linux). Follow the cli instructions to complete the build process.

> [!Note]
> The built executable will be in the `/release/dev` folder at the root. Do not forget to test the built version of the app to ensure everything is working as expected.

> [!WARNING]
> Do not send productions builds as pull requests. If you want to contribute, please only submit code changes and let the CI/CD pipeline handle the production build process.

## Contributing

Contriutions are welcome and appreciated! If you want to contribute to Carbon SSH, please check out [contributing guidelines](CONTRIBUTING.md) for more details on how to get started.
