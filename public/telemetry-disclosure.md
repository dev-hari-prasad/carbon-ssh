# Carbon Telemetry - The Straightforward Disclosure

Telemetry is enabled by default, but can be disabled anytime in Settings > General > Share anonymous usage data. **This policy is deliberately placed right next to the toggle in settings, so you can make an informed decision before toggling it and to put forth a different perspective on telemetry**.

**If you care about security, you know the rule: ship less telemetry, not more**. 100% agreed and valid. But the reality is, without telemetry, maintainers will not be able to know where the app crashes, how users interact with the UI, which feature is the most used and how many users use the app (which are **motivating factors for the maintainers**).

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
- Anonymous connection success/failure categories with only classifcation not data of the connection or failure error message
- Crash reports with sensitive data stripped out, it contains only error classification and error code so we can fix the bug
- App version and operating system to track the most used version and plan for the next release and to decide where to focus more development effort

---

## Privacy approach

- Analytics use a random anonymous ID stored locally on your device
- No session replay, screen recording, or invasive tracking
- No account-based identity tracking
- Sensitive data is filtered before anything is sent

We use PostHog for analytics which is a privacy respecting, widely trusted and GDPR compliant analytics platform. You can find out more about PostHog at [posthog.com](https://posthog.com/privacy).

---

## Verify for yourself

You don't have to trust us blindly. You can check the exact code that handles the telemetry services on our [GitHub repository](https://github.com/CarbonSSH/carbon) and then navigating to:

- `src/lib/telemetry.ts` (Core logic, consent, and capture helpers)
- `src/lib/telemetry-sanitize.ts` (The filters that explicitly strip out sensitive data)
- `src/lib/telemetry-config.ts` (Environment setup)