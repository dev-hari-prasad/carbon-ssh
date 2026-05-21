# Carbon Telemetry - The Straightforward Disclosure

During onboarding, Carbon asks for your consent to share anonymous usage data. Telemetry is enabled by default; you choose at setup and can change it anytime in **Settings > General > Privacy > Analytics**.

---

## What we never collect

- SSH credentials, private keys, or passwords
- Terminal commands or output
- Hostnames, IPs, or usernames
- File paths, environment variables, or clipboard contents
- Anything that identifies your servers or workflow
- Anything that is sensitive and private

## What we do collect

- Basic app events (app opened, settings opened, setup completed)
- Anonymous connection success/failure categories — classification only, not connection data or error messages
- Crash reports with sensitive data stripped out — error classification and error code only
- App version and operating system

---

## Privacy approach

- Analytics use a random anonymous ID stored locally on your device
- No session replay, screen recording, or invasive tracking
- No account-based identity tracking
- Sensitive data is filtered before anything is sent

We use [PostHog](https://posthog.com/privacy) for analytics — a privacy-respecting, GDPR-compliant platform.

---

## Verify for yourself

You don't have to trust us blindly.

- **Full application audit:** [carbonssh.com/audit](https://carbonssh.com/audit)
- **Source code** on [GitHub](https://github.com/CarbonSSH/carbon):
  - `src/lib/telemetry.ts` — core logic, consent, and capture helpers
  - `src/lib/telemetry-sanitize.ts` — filters that strip sensitive data
  - `src/lib/telemetry-config.ts` — environment setup
