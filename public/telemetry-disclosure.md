# Carbon Telemetry: The Straightforward Anonymous Usage Analytics Policy

### Why Telemetry is ON by Default
If you care about security, you know the rule: ship *less* telemetry, not more. We agree with that instinct. But Carbon ships with analytics **enabled** by default for one blunt reason: without it, we are flying completely blind. 

If we don't get these anonymous signals, we have no idea how many people are actually using the app, what is breaking in the wild, or if our recent updates actually helped. These metrics are exactly what motivates us to keep building Carbon. 

If that trade-off isn't worth it for you, disable it. No lecture.
**Settings → General → Privacy → Analytics** → toggle **Share anonymous usage analytics.**

---

### 🛑 What we NEVER collect
Your shell and servers are your business. We never touch:
* Passwords, private keys, or SSH credentials.
* Hostnames, IP addresses, or usernames.
* Terminal commands, console output, or clipboard contents.
* File paths or environment variables.
* Any information about your SSH hosts not even remotely related to the SSH connection itself like metadata, labels, tags, or anything else.
* Or anything else that could be used to identify you.

### 🟢 What we DO collect
We only track broad, anonymous actions:
* **App actions:** When you open the app, finish initial setup, or click major UI features (e.g., "Opened Settings").
* **Connection status:** If an SSH connection succeeds or fails. (For failures, we only see the *category* like "network error"—we don't see the server or the real error text).
* **Crashes:** Basic error categories with sanitized text (paths and IPs stripped out).
* **System info:** Your Carbon version and OS type (Mac/Windows/Linux/Web).

---

### Anonymity & Under the Hood
* **Random ID:** We use a random, anonymous ID stored locally on your device. It is not tied to your name, email, or hardware.
* **No creepy background tracking:** We do **not** run background A/B testing trackers (`/decide` traffic is explicitly blocked).
* **Backend:** If configured, data is sent to PostHog, but it only contains the event labels described above, the random ID, and a public ingest key. No IP addresses, hostnames, or other identifying information.

---

### Carbon vs. Corporate Analytics
We deliberately avoid the bloated tracking most apps use. Here is the exact difference:

| What Most Corporate Apps Do | What Carbon Actually Does |
| :--- | :--- |
| **Session Replays:** Record video-style replays of you clicking around the app. | **Turned OFF.** We never record your screen or sessions. |
| **Massive Tracking:** Log every single mouse tap, hover, and scroll. | **Not Used.** We only track intentional, broad actions (like "App Opened"). |
| **Identity Tracking:** Link your logged-in email and account straight to their charts. | **Anonymous Local ID.** We use a random ID stored only on your machine. |
| **Vacuuming Sensitive Data:** Mix your private workflow (like your terminal shell) into analytics streams. | **Vague Buckets Only.** Failures stop at generic labels. Terminals and hosts are totally excluded. |

---

### Don't take our word for it: Verify it yourself
You don't have to trust us blindly. You can check the exact code that handles this here:
* `src/lib/telemetry.ts` (Core logic, consent, and capture helpers)
* `src/lib/telemetry-sanitize.ts` (The filters that explicitly strip out sensitive data)
* `src/lib/telemetry-config.ts` (Environment setup)