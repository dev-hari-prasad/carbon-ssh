# Security Guard — Implementation Plan

> **Document version:** 0.1-draft
> **Author:** Architecture Team
> **Last updated:** 2026-05-08
> **Status:** Pre-implementation planning
> **Product:** Carbon — AI-powered SSH terminal platform

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Core Product Philosophy](#2-core-product-philosophy)
3. [Initial MVP Scope](#3-initial-mvp-scope)
4. [One-Click Lockdown Protocols](#4-one-click-lockdown-protocols)
5. [Rollback & Recovery System](#5-rollback--recovery-system)
6. [AI Layer](#6-ai-layer)
7. [Security Analysis Engine](#7-security-analysis-engine)
8. [Multi-Machine Support](#8-multi-machine-support)
9. [UI/UX Plan](#9-uiux-plan)
10. [Technical Stack Suggestions](#10-technical-stack-suggestions)
11. [Security Risks & Liability](#11-security-risks--liability)
12. [Competitive Analysis](#12-competitive-analysis)
13. [Monetization Opportunities](#13-monetization-opportunities)
14. [Long-Term Vision](#14-long-term-vision)
15. [Development Roadmap](#15-development-roadmap)

---

## 1. Feature Overview

### What Security Guard Is

Security Guard is an integrated security auditing and hardening engine built directly into Carbon. It connects to any Linux VPS over SSH, runs a deterministic battery of security checks, scores the machine, and offers one-click (or selective) hardening — with full rollback support.

It is **not** a chatbot that tells you about security. It is a purpose-built tool that **does** security work on your server, with AI layered in only where it genuinely helps (explanations, prioritization, natural-language queries about findings).

### What Problem It Solves

Most developers who deploy to Linux VPS machines (DigitalOcean, Hetzner, Linode, AWS EC2, etc.) are not security engineers. They:

- Leave SSH on port 22 with password auth enabled
- Run everything as root
- Never configure a firewall
- Don't set up fail2ban or any intrusion prevention
- Expose Docker daemon ports to the internet
- Never run security updates after initial setup
- Have no idea what CVEs affect their installed packages

The result: machines get compromised within hours or days of deployment. Cryptominers, botnets, data exfiltration — all from trivially preventable misconfigurations.

**Security Guard makes a fresh or existing VPS production-safe in under 2 minutes.**

### Why It Matters

1. **Real harm prevention.** Compromised servers cost real money, leak real data, and destroy real businesses.
2. **No existing tool does this well for normal developers.** Lynis gives you a 500-line report and expects you to know what to do. CrowdSec requires infrastructure knowledge. Cockpit is sysadmin-oriented.
3. **Trust gap.** Developers know they *should* secure their servers but don't because the tooling is hostile and the risk of breaking something is too high.

### Differentiation from Generic AI Terminal Assistants

| Generic AI Terminal | Security Guard |
|---|---|
| "Ask me anything about Linux" | Purpose-built security scanner with deterministic checks |
| Generates commands you copy-paste | Executes hardening with rollback safety net |
| No state, no memory of your server | Knows your server's exact configuration, installed packages, open ports |
| Can hallucinate dangerous commands | AI never executes — only explains. All actions are deterministic scripts |
| No audit trail | Full audit log of every check, finding, and action taken |
| One-shot advice | Continuous drift detection and re-scanning |

The key differentiator: **Security Guard is a tool, not a conversation.** AI enhances the tool. It does not replace it.

---

## 2. Core Product Philosophy

### Principle 1: Deterministic Security > Pure AI Guessing

Every security check must have a deterministic, auditable implementation. "Is password authentication enabled?" is answered by parsing `/etc/ssh/sshd_config`, not by asking an LLM to guess. The scanner runs real commands (`ss -tlnp`, `ufw status`, `cat /etc/passwd`), parses real output, and makes real binary pass/fail decisions.

AI is used **after** the facts are gathered — to explain, prioritize, and suggest. Never to determine.

### Principle 2: AI Should Enhance, Not Replace

The AI layer exists for three purposes:
1. **Explain findings** in plain English ("This CVE allows remote code execution via a buffer overflow in OpenSSL's TLS handshake")
2. **Prioritize remediations** based on the specific server context ("You're running a web server, so the exposed Docker socket is your highest risk")
3. **Answer questions** about the security report ("Why is this scored as critical?" / "What happens if I disable root login?")

AI never generates or executes security commands. All hardening actions are pre-written, tested scripts with known behavior.

### Principle 3: Safety-First Automation

Automated hardening is inherently dangerous. A bad firewall rule locks you out. A bad sshd_config change kills your session. A bad package removal breaks your application.

Rules:
- **Never change anything without explicit user confirmation** (unless in a pre-approved lockdown profile)
- **Always explain what will change before changing it**
- **Always test connectivity after SSH config changes** (keep a background session alive)
- **Never close the current SSH session until the new config is validated**

### Principle 4: Rollback-First Design

Every change must be reversible. This is not optional. This is the architecture.

Before any modification:
1. Back up the affected config file(s)
2. Record the exact commands that will be run
3. Record the inverse commands (undo)
4. Store a timestamped snapshot

If anything goes wrong — network timeout, unexpected error, user panic — the rollback path must be immediate and obvious.

### Principle 5: Trust and Transparency

Users are handing us root access to their production machines. That is an extraordinary level of trust.

We earn it by:
- Showing every command before it runs
- Never sending server data to external services without consent
- Making the scanner open-source or at minimum fully auditable
- Providing complete audit logs
- Never auto-executing anything in the background
- Being honest about limitations ("We cannot detect sophisticated rootkits with a userspace scan")

---

## 3. Initial MVP Scope

### MVP Definition

The first usable version of Security Guard must:
1. Connect to a Linux machine over SSH (already handled by Carbon)
2. Run a comprehensive security audit in under 60 seconds
3. Present findings with severity scores
4. Offer one-click fixes for critical/high issues
5. Support full rollback of any change

### Feature Matrix

| # | Feature | What It Does | Why It Matters | Implementation Difficulty | Risk Level | MVP Priority |
|---|---------|-------------|----------------|--------------------------|------------|--------------|
| 1 | SSH Security Audit | Parses `sshd_config`, checks protocol version, key exchange algos, MACs, ciphers, login grace time, max auth tries | SSH is the front door. Weak SSH config = game over | Low | Low | **P0** |
| 2 | Firewall Status Check | Detects if UFW/iptables/nftables is active, parses rules, identifies overly permissive rules (0.0.0.0/0 on sensitive ports) | No firewall = every service is internet-exposed | Low | Low | **P0** |
| 3 | Fail2ban Analysis | Checks if fail2ban is installed, running, configured for sshd, checks ban time/find time/max retry settings | Without fail2ban, brute-force attacks are trivially easy | Low | Low | **P0** |
| 4 | Root Login Check | Reads `PermitRootLogin` from sshd_config, checks if root has a password set, checks for root SSH keys | Root login over SSH is the #1 server compromise vector | Very Low | Low | **P0** |
| 5 | Password Auth Check | Reads `PasswordAuthentication`, `ChallengeResponseAuthentication`, `UsePAM` from sshd_config | Password auth enables brute-force. Key-only is the standard | Very Low | Low | **P0** |
| 6 | SSH Port Analysis | Reads listening port from sshd_config and verifies with `ss -tlnp`, checks if non-standard port is used, verifies firewall allows it | Port 22 gets hammered by bots constantly. Non-standard port reduces noise 95%+ | Very Low | Low | **P0** |
| 7 | Docker Exposure Check | Checks if Docker daemon is listening on TCP (2375/2376), checks Docker socket permissions, checks for `--privileged` containers, checks Docker network exposure | Exposed Docker daemon = unauthenticated root access to the host | Medium | Medium | **P0** |
| 8 | UFW Setup & Hardening | Installs UFW if missing, enables with sane defaults (deny incoming, allow outgoing, allow current SSH port), adds rules for detected services | UFW is the simplest path to a working firewall on Ubuntu/Debian | Low | **High** | **P0** |
| 9 | Unattended Security Upgrades | Checks if `unattended-upgrades` is installed and configured, verifies security repo is enabled, checks auto-reboot settings | Unpatched vulnerabilities are exploited within hours of disclosure | Low | Medium | **P1** |
| 10 | Package Vulnerability Scan | Runs `apt list --upgradable` or equivalent, cross-references with known CVE databases (Ubuntu USN, Debian DSA), identifies critical/high CVEs in installed packages | Known vulnerabilities in installed software are the lowest-hanging fruit for attackers | Medium | Low | **P1** |
| 11 | User & Sudo Analysis | Enumerates users in `/etc/passwd`, checks sudo group membership, checks `/etc/sudoers` and `/etc/sudoers.d/*` for NOPASSWD entries, identifies dormant accounts | Overprivileged or forgotten user accounts are lateral movement vectors | Medium | Low | **P1** |
| 12 | Basic Malware/Rootkit Scan | Checks for known cryptominer processes, suspicious cron entries, unexpected SUID binaries, checks `/tmp` and `/dev/shm` for suspicious executables, optionally runs `chkrootkit` or `rkhunter` if installed | Catches the most common post-compromise artifacts | High | Low | **P1** |
| 13 | Security Score System | Aggregates all findings into a weighted score (0–100), categorizes by severity (Critical/High/Medium/Low/Info), provides letter grade (A–F) | Users need a single number to understand their security posture and track improvement | Medium | Low | **P0** |

### Feature Details

#### 3.1 SSH Security Audit

**Implementation:**
```
Parse /etc/ssh/sshd_config (handle Include directives)
Check:
  - Protocol 2 only (legacy check for old systems)
  - PermitRootLogin: should be "no" or "prohibit-password"
  - PasswordAuthentication: should be "no"
  - PermitEmptyPasswords: must be "no"
  - MaxAuthTries: should be ≤ 4
  - LoginGraceTime: should be ≤ 60
  - X11Forwarding: should be "no" unless needed
  - AllowTcpForwarding: audit only (context-dependent)
  - ClientAliveInterval / ClientAliveCountMax: should be set
  - KexAlgorithms: flag weak algorithms (diffie-hellman-group1-sha1, etc.)
  - Ciphers: flag weak ciphers (3des-cbc, arcfour, etc.)
  - MACs: flag weak MACs (hmac-md5, hmac-sha1, etc.)
  - AuthorizedKeysFile: verify standard location
  - Banner: recommend setting one (legal/deterrent value)
```

**Edge cases:**
- Systems using `Include` directives in sshd_config (OpenSSH 8.4+) — must follow includes
- Systems using Match blocks — port/auth settings may differ per user/group
- Cloud-init managed configs that get overwritten on reboot
- Systems where sshd_config is managed by Ansible/Puppet — warn about drift

**Remediation:**
- Generate a hardened sshd_config diff
- Apply changes, reload sshd (NOT restart — reload is non-disruptive)
- Keep current session alive, open test connection on new terminal before confirming
- If test connection fails, auto-rollback within 30 seconds

#### 3.2 Firewall Status Check

**Implementation:**
```
1. Detect firewall backend:
   - Check for UFW: `which ufw && ufw status`
   - Check for firewalld: `which firewall-cmd && firewall-cmd --state`
   - Check for raw iptables: `iptables -L -n`
   - Check for nftables: `nft list ruleset`
2. Parse active rules
3. Flag dangerous patterns:
   - No firewall active at all (CRITICAL)
   - Default ACCEPT policy on INPUT chain (HIGH)
   - 0.0.0.0/0 allowed on ports: 3306, 5432, 6379, 27017, 9200 (CRITICAL)
   - 0.0.0.0/0 allowed on Docker daemon port 2375/2376 (CRITICAL)
   - No rate limiting on SSH port (MEDIUM)
4. Verify SSH port is allowed (prevent lockout during hardening)
```

**Edge cases:**
- Cloud provider firewalls (AWS Security Groups, DO Firewall) exist outside the OS — cannot detect, must warn
- Docker manipulates iptables directly, bypassing UFW — this is a known footgun, must explicitly check
- Systems using both UFW and raw iptables rules — conflicts

#### 3.3 Fail2ban Analysis

**Implementation:**
```
1. Check installation: dpkg -l fail2ban || rpm -qa fail2ban
2. Check service status: systemctl is-active fail2ban
3. Parse /etc/fail2ban/jail.local and /etc/fail2ban/jail.d/*
4. Verify [sshd] jail is enabled
5. Check settings:
   - bantime: recommend ≥ 3600 (1 hour), flag if < 600
   - findtime: recommend ≥ 600
   - maxretry: recommend ≤ 5, flag if > 10
6. Check ban backend (systemd preferred on modern systems)
7. Count current bans: fail2ban-client status sshd
8. Check log target exists and is writable
```

**Remediation:**
- Install fail2ban if missing
- Deploy sane jail.local for sshd
- Enable and start service
- Verify first ban works (optional self-test)

#### 3.4 Root Login Check

**Implementation:**
```
1. Parse PermitRootLogin from sshd_config
2. Check if root account has a password: getent shadow root | check for locked/no-password
3. Check for SSH keys: ls -la /root/.ssh/authorized_keys
4. Check if any sudoers entry gives unrestricted root
5. Flag: root login enabled + password set = CRITICAL
6. Flag: root login enabled + SSH keys present = HIGH (might be intentional)
7. Flag: root account not locked even if SSH login disabled = MEDIUM
```

#### 3.5 Password Auth Check

**Implementation:**
```
1. Parse PasswordAuthentication from sshd_config (including Match blocks)
2. Parse ChallengeResponseAuthentication (deprecated but still functional on older systems)
3. Parse KbdInteractiveAuthentication (replacement on newer OpenSSH)
4. Parse UsePAM — if yes, PAM can override PasswordAuthentication
5. Verify at least one SSH key exists for at least one user
6. If disabling password auth: verify key-based login works FIRST
```

**Critical safety note:** Disabling password auth without verifying key access will lock out the user. This is the single most dangerous hardening action. Must be gated behind explicit verification.

#### 3.6 SSH Port Analysis

**Implementation:**
```
1. Read Port directive from sshd_config
2. Verify with ss -tlnp | grep sshd
3. If port 22: recommend changing (reduces bot noise, not a security boundary)
4. If non-standard: verify firewall allows new port
5. Check if SELinux/AppArmor needs port policy update
6. Verify cloud firewall allows the port (best-effort: check common metadata APIs)
```

**Remediation safety:**
- When changing SSH port: add new port rule to firewall FIRST
- Then change sshd_config
- Reload sshd
- Test connection on new port
- Only then remove old port from firewall
- If any step fails: rollback all changes

#### 3.7 Docker Exposure Check

**Implementation:**
```
1. Check if Docker is installed: which docker
2. Check daemon config: /etc/docker/daemon.json — look for "hosts" with tcp://
3. Check systemd override: /etc/systemd/system/docker.service.d/ — look for -H tcp://
4. Check listening ports: ss -tlnp | grep dockerd
5. Check Docker socket permissions: stat /var/run/docker.sock
6. List running containers: docker ps --format
7. Flag --privileged containers
8. Flag containers with --net=host
9. Flag containers with sensitive volume mounts (/, /etc, /var/run/docker.sock)
10. Check if Docker group has non-root users (docker group = root equivalent)
```

#### 3.8 UFW Setup & Hardening

**Implementation:**
```
1. If UFW not installed: apt install ufw -y
2. Detect currently used SSH port
3. Set default policies: ufw default deny incoming && ufw default allow outgoing
4. Allow SSH: ufw allow <detected-ssh-port>/tcp
5. Detect running services and suggest rules:
   - HTTP/HTTPS (80/443) if nginx/apache/caddy running
   - Application ports if Node/Python/Go listening
6. Enable UFW: ufw --force enable
7. Verify SSH still works
```

**Risk:** Enabling UFW with wrong rules locks out SSH. This is why we detect the SSH port first and add the allow rule before enabling.

**Docker interaction warning:** UFW does NOT control Docker-published ports by default. Docker manipulates iptables directly, bypassing UFW. Must install `ufw-docker` or configure Docker's iptables settings. This must be called out prominently in the UI.

#### 3.9 Security Score System

**Scoring model:**

| Severity | Weight | Examples |
|----------|--------|---------|
| Critical | 25 points each | No firewall, root password auth enabled, Docker TCP exposed |
| High | 15 points each | Password auth enabled, no fail2ban, weak SSH ciphers |
| Medium | 8 points each | SSH on port 22, no unattended upgrades, NOPASSWD sudo |
| Low | 3 points each | No SSH banner, permissive umask, unnecessary SUID binaries |
| Info | 0 points | Informational findings, context notes |

**Score calculation:**
```
max_possible = sum of all check weights
penalty = sum of failed check weights
score = max(0, 100 - (penalty / max_possible * 100))
```

**Grade mapping:**

| Score | Grade | Label |
|-------|-------|-------|
| 90–100 | A | Excellent |
| 75–89 | B | Good |
| 60–74 | C | Needs Improvement |
| 40–59 | D | Poor |
| 0–39 | F | Critical Risk |

---

## 4. One-Click Lockdown Protocols

### Design Principles

Lockdown protocols are **preset bundles of hardening actions** tailored to common server roles. Each protocol has:
- A defined set of actions (no ambiguity)
- A danger rating
- A clear rollback path
- A pre-flight check that aborts if conditions aren't safe

### Protocol 1: Personal VPS

**Use case:** Side projects, personal blogs, hobby servers, development machines.

**Danger level:** 🟢 Low

| Action | Detail |
|--------|--------|
| Disable root SSH login | `PermitRootLogin no` in sshd_config |
| Disable password authentication | `PasswordAuthentication no` (only after verifying key auth works) |
| Install and configure UFW | Deny incoming, allow SSH + HTTP + HTTPS |
| Install and configure fail2ban | SSH jail, 1-hour ban, 5 max retries |
| Enable unattended security upgrades | `unattended-upgrades` with security repo only |
| Change SSH port | Move to random high port (10000–65000 range) |
| Set up automatic security updates | Configure apt daily security updates |
| Disable X11 forwarding | `X11Forwarding no` |
| Create non-root deploy user | If only root exists, create a sudo-capable user |

**Packages installed:** `ufw`, `fail2ban`, `unattended-upgrades`

**Configs changed:** `/etc/ssh/sshd_config`, `/etc/ufw/*`, `/etc/fail2ban/jail.local`, `/etc/apt/apt.conf.d/50unattended-upgrades`

**Ports affected:** SSH port changes, incoming ports restricted to SSH + 80 + 443

**Rollback strategy:**
1. All original configs backed up to `/var/lib/carbon/backups/<timestamp>/`
2. Rollback script generated at `/var/lib/carbon/rollback-<timestamp>.sh`
3. Single command restores all configs and reloads services
4. If SSH config change fails, auto-rollback triggers within 30 seconds via background watchdog

### Protocol 2: Production Server

**Use case:** SaaS applications, APIs, web services serving real users.

**Danger level:** 🟡 Medium

Everything from Personal VPS, plus:

| Action | Detail |
|--------|--------|
| Harden SSH ciphers/KEX/MACs | Remove weak algorithms, enforce modern crypto |
| Configure `sysctl` security parameters | `net.ipv4.conf.all.rp_filter=1`, `net.ipv4.icmp_echo_ignore_broadcasts=1`, disable IP forwarding (unless routing needed), enable TCP SYN cookies |
| Set up log rotation | Ensure `/var/log` doesn't fill disk |
| Configure `auditd` | Basic audit rules for auth events, sudo usage, file changes in `/etc` |
| Restrict cron | Limit cron to specific users |
| Set secure `umask` | System-wide `umask 027` |
| Disable unused services | Stop and disable `avahi-daemon`, `cups`, `bluetooth`, etc. if present |
| Configure `logwatch` or `logcheck` | Daily security log summaries |

**Additional packages:** `auditd`, `logwatch`, `libpam-tmpdir`

**Rollback strategy:** Same as Personal VPS, plus auditd rules backup and sysctl backup.

### Protocol 3: AI GPU Machine

**Use case:** ML training rigs, inference servers, Jupyter-hosting GPU machines.

**Danger level:** 🟡 Medium

Everything from Production Server, plus:

| Action | Detail |
|--------|--------|
| Restrict Jupyter/JupyterHub ports | Firewall Jupyter to specific IPs or VPN only |
| Secure NVIDIA driver/CUDA stack | Check for known NVIDIA container toolkit vulnerabilities |
| Lock down exposed model serving ports | TensorFlow Serving (8500/8501), TorchServe (8080/8081), Triton (8000/8001/8002) — restrict to internal or VPN |
| Monitor GPU processes | Flag unexpected GPU utilization (cryptomining detection) |
| Secure shared memory | Restrict `/dev/shm` mount options |
| Check for exposed Jupyter tokens | Detect default/empty Jupyter tokens in config |

**Ports affected:** Jupyter (8888), model serving ports locked to internal IPs.

### Protocol 4: Docker Host

**Use case:** Servers running Docker containers as the primary workload.

**Danger level:** 🔴 High

Everything from Production Server, plus:

| Action | Detail |
|--------|--------|
| Disable Docker TCP socket | Remove any `-H tcp://` flags |
| Configure Docker daemon security | `"no-new-privileges": true`, `"userns-remap": "default"`, `"live-restore": true` |
| Install `ufw-docker` utility | Fix the UFW/Docker iptables bypass problem |
| Enable Docker content trust | `DOCKER_CONTENT_TRUST=1` |
| Configure Docker log rotation | Prevent container logs from filling disk |
| Audit running containers | Flag `--privileged`, `--net=host`, sensitive mounts |
| Set up Docker Bench Security | Run CIS Docker benchmark checks |
| Restrict Docker group membership | Audit and warn about non-root Docker group members |

**Why high danger:** Docker networking is complex. Changing Docker's iptables behavior or enabling user namespaces can break running containers. Must warn user explicitly and recommend testing in staging first.

**Rollback strategy:** Docker daemon.json backup, systemd override backup, full iptables snapshot before changes.

### Protocol 5: Startup SaaS Server

**Use case:** Early-stage startup production servers. Balance between security and "move fast."

**Danger level:** 🟡 Medium

This is effectively Production Server protocol with:

| Addition | Rationale |
|----------|-----------|
| HTTPS enforcement check | Verify Let's Encrypt or equivalent is set up |
| Database port lockdown | Ensure 3306/5432/6379/27017 are not internet-exposed |
| Environment variable audit | Check for secrets in process environment (best-effort) |
| Backup verification | Check if any backup mechanism exists (not create one, just verify) |
| SSL/TLS configuration check | Verify strong TLS configuration on web servers |
| Rate limiting check | Check if nginx/app-level rate limiting exists |

---

## 5. Rollback & Recovery System

### Why This Is The Most Important Section

Automated security hardening can brick a server. If we lock a user out of their own machine, we have failed catastrophically. The rollback system is not a nice-to-have — it is the foundation that makes everything else possible.

### Architecture

```
┌─────────────────────────────────────────────┐
│              Rollback Manager                │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │  Snapshot    │  │  Change Ledger       │  │
│  │  Engine      │  │  (ordered log of     │  │
│  │  (pre-change │  │   every modification │  │
│  │   backups)   │  │   with inverse cmd)  │  │
│  └─────────────┘  └──────────────────────┘  │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │  Watchdog    │  │  Recovery Shell      │  │
│  │  Timer       │  │  (emergency access   │  │
│  │  (auto-undo  │  │   via alternative    │  │
│  │   on timeout)│  │   channel)           │  │
│  └─────────────┘  └──────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### 5.1 Pre-Change Snapshots

Before ANY modification, the system creates:

```
/var/lib/carbon/backups/<session-id>/
├── manifest.json          # What was changed, when, why
├── configs/
│   ├── etc-ssh-sshd_config
│   ├── etc-ufw-ufw.conf
│   ├── etc-fail2ban-jail.local
│   └── ...
├── state/
│   ├── iptables-save.txt
│   ├── ufw-status.txt
│   ├── systemd-units.txt
│   └── ss-listening.txt
├── rollback.sh            # Single script to undo everything
└── audit.log              # Human-readable log of session
```

**`manifest.json` structure:**
```json
{
  "session_id": "sg-20260508-143022",
  "timestamp": "2026-05-08T14:30:22Z",
  "machine": "203.0.113.50",
  "protocol": "production-server",
  "changes": [
    {
      "id": "chg-001",
      "type": "config_modify",
      "target": "/etc/ssh/sshd_config",
      "description": "Disable password authentication",
      "backup_path": "configs/etc-ssh-sshd_config",
      "forward_commands": [
        "sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config",
        "systemctl reload sshd"
      ],
      "rollback_commands": [
        "cp /var/lib/carbon/backups/sg-20260508-143022/configs/etc-ssh-sshd_config /etc/ssh/sshd_config",
        "systemctl reload sshd"
      ],
      "status": "applied",
      "applied_at": "2026-05-08T14:30:25Z"
    }
  ]
}
```

### 5.2 Config Backups

**What gets backed up (always):**
- `/etc/ssh/sshd_config` and `/etc/ssh/sshd_config.d/*`
- `/etc/ufw/*`
- `/etc/fail2ban/jail.local`, `/etc/fail2ban/jail.d/*`
- `/etc/sysctl.conf`, `/etc/sysctl.d/*`
- `/etc/sudoers`, `/etc/sudoers.d/*`
- Full `iptables-save` output
- List of installed packages (for package operations)
- Docker daemon.json (if Docker is present)
- Any other file about to be modified

**Backup storage:**
- Stored locally on the target machine at `/var/lib/carbon/backups/`
- Optionally synced to Carbon client for offline access
- Retained for 30 days by default (configurable)
- Never deleted automatically during a session

### 5.3 Rollback Commands

Every change generates an inverse operation. These are NOT AI-generated — they are deterministic, code-defined rollback paths.

**Example rollback pairs:**

| Forward Action | Rollback Action |
|---------------|----------------|
| `ufw enable` | `ufw disable` |
| Modify sshd_config | Restore from backup + `systemctl reload sshd` |
| `apt install fail2ban` | `apt remove fail2ban` (only if we installed it) |
| `systemctl disable <service>` | `systemctl enable <service>` |
| Add iptables rule | Remove specific rule by handle |
| Create user | Remove user (with confirmation) |
| Change SSH port | Restore original port + reload |

### 5.4 Undo Support

The UI provides granular undo:

1. **Undo last change** — Reverts the most recent modification
2. **Undo specific change** — User picks from the change ledger
3. **Undo entire session** — Reverts all changes from the current hardening session
4. **Undo lockdown protocol** — Reverts all changes from a specific protocol execution

Each undo operation is itself logged and snapshot-protected (undo the undo).

### 5.5 Recovery Shell

**Problem:** If an SSH config change breaks connectivity, the user cannot SSH in to rollback.

**Solutions (ordered by reliability):**

1. **Watchdog timer (primary):**
   - Before applying SSH config changes, start a background process on the server
   - The watchdog waits for a "confirmation" signal within 60 seconds
   - If no confirmation received (because the user got locked out), it auto-reverts sshd_config and reloads
   - Implementation: `nohup bash -c 'sleep 60 && cp <backup> /etc/ssh/sshd_config && systemctl reload sshd' &`

2. **Parallel session (secondary):**
   - Before changing SSH config, open a second SSH connection
   - Keep it alive throughout the change
   - If primary connection fails, use secondary to rollback
   - Only proceed with changes if secondary connection is confirmed alive

3. **Console access guidance (tertiary):**
   - If all SSH access is lost, provide instructions for cloud provider console access
   - DigitalOcean: Recovery Console
   - AWS: EC2 Serial Console or Instance Connect
   - Hetzner: Rescue Mode
   - Linode: Lish Console
   - Pre-detect the cloud provider and show relevant instructions

4. **Out-of-band recovery script (quaternary):**
   - Before any SSH changes, deploy a cron job that checks for a "heartbeat" file
   - If the heartbeat file isn't updated within 5 minutes, auto-revert all recent changes
   - This is the last resort before console access

### 5.6 Safe Mode

If the server is in a broken state after a Security Guard session:

1. Detect failed state (connection timeout, service errors)
2. Attempt connection on original SSH port + new SSH port
3. Attempt connection with original auth method + new auth method
4. If connected, offer "Safe Mode": revert ALL Security Guard changes to restore pre-session state
5. If not connected, guide user to cloud console with exact rollback commands

### 5.7 Failed-Lockdown Recovery

**Scenario:** User runs "Production Server" lockdown, something goes wrong mid-process.

**Partial failure handling:**
- Each action in the protocol is atomic (succeeds or rolls back individually)
- If action #5 of 12 fails, actions 1–4 remain applied (they succeeded)
- User is notified: "Lockdown partially applied. 4 of 12 actions succeeded, 1 failed, 7 skipped."
- User can: retry failed action, skip it, or rollback everything

**Never leave the server in an ambiguous state.** Every action's status is tracked: `pending`, `applied`, `failed`, `rolled_back`, `skipped`.

---

## 6. AI Layer

### 6.1 Conversational Security Assistant

The AI assistant operates within the context of the scanned server. It has access to:
- The full scan results (findings, severity, affected configs)
- The server's OS, version, installed packages
- The current security score and grade
- The change history (what has been hardened, what hasn't)

**Example interactions:**

```
User: "Why is my score so low?"
AI: "Your server scored 34/100 (F) primarily because:
     1. No firewall is active (Critical, -25 points)
     2. SSH password authentication is enabled with root login allowed (Critical, -25 points)
     3. No fail2ban or intrusion prevention (High, -15 points)
     Running the 'Personal VPS' lockdown protocol would address all three and
     likely bring your score above 80."

User: "What does CVE-2024-6387 mean for my server?"
AI: "CVE-2024-6387 (regreSSHion) is a remote code execution vulnerability in
     OpenSSH's sshd server. Your server is running OpenSSH 9.2p1, which IS
     affected. An unauthenticated attacker could potentially gain root access.
     Fix: apt update && apt upgrade openssh-server. This is your highest
     priority remediation."

User: "Is it safe to disable password auth?"
AI: "I can see 2 SSH keys configured for user 'deploy' and 1 for user 'admin'.
     Both users have valid key-based login. Disabling password auth should be
     safe. However, if you have any scripts or CI/CD pipelines that SSH in with
     a password, they will break. Do you want me to check for recent password-
     based logins in the auth log?"
```

### 6.2 Vulnerability Explanations

For every CVE found during the package scan, the AI provides:
- **Plain English explanation** of what the vulnerability allows
- **Exploitability assessment** (is there a public exploit? Is it remotely exploitable?)
- **Impact assessment** specific to this server (e.g., "This affects libcurl, and you have 3 applications that link against it")
- **Remediation steps** (always deterministic: specific `apt` commands, not vague advice)

### 6.3 Risk Prioritization

The AI considers the full picture to prioritize remediations:

```
Priority factors:
1. Severity of the vulnerability/misconfiguration
2. Exposure (internet-facing vs. internal-only)
3. Active exploitation in the wild
4. Ease of remediation (quick wins first)
5. Risk of the fix itself (reboot-required, service-disrupting)
6. Server role context (database server vs. web server vs. dev machine)
```

### 6.4 Where AI Should NEVER Be Trusted

| Domain | Why AI Is Dangerous Here |
|--------|------------------------|
| Generating shell commands for execution | Hallucinated commands can destroy data or brick servers |
| Determining if a service is "safe to stop" | Context-dependent, AI lacks full system understanding |
| Firewall rule generation | Wrong rules = lockout or exposure |
| Cryptographic configuration | Subtle errors create false sense of security |
| Declaring a server "secure" | AI cannot guarantee absence of threats |
| Rootkit/malware detection | Sophisticated malware evades userspace detection; AI adding false confidence is harmful |

**Hard rule:** AI output is NEVER executed as commands. All executable actions are deterministic, code-defined, and pre-tested. The AI layer is read-only with respect to the server.

### 6.5 Deterministic Checks vs. AI Inference

| Aspect | Deterministic Check | AI Inference |
|--------|-------------------|--------------|
| "Is PasswordAuthentication enabled?" | Parse sshd_config → yes/no | Never |
| "Is this CVE critical for my server?" | CVE database lookup → severity rating | AI adds context about exploitability and impact |
| "Should I allow port 8080?" | Cannot determine (context-dependent) | AI asks about the service and recommends based on role |
| "Is this cron entry suspicious?" | Pattern match against known malware | AI explains why it might be suspicious if pattern match is inconclusive |
| "What should I prioritize fixing?" | Sort by severity score | AI re-ranks considering server context, active exploits, operational impact |

### 6.6 Hallucination Prevention

1. **Ground all responses in scan data.** The AI prompt includes the actual scan results, not summaries. If the AI says "you have 3 critical findings," the prompt contains those exact 3 findings.
2. **Never let AI generate commands.** Remediation commands are looked up from a deterministic remediation database, then the AI explains them.
3. **Confidence indicators.** When the AI is inferring rather than reporting facts, it must say so: "Based on the scan results, it appears..." vs. "The scan confirmed that..."
4. **Fact-check layer.** Before displaying AI explanations of CVEs, cross-reference the AI's claims against the actual CVE database entry. If they conflict, show the database entry.
5. **No speculation about threats.** The AI does not say "you might be under attack" unless there is specific evidence (suspicious processes, failed login spikes, etc.).

---

## 7. Security Analysis Engine

### 7.1 Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                Carbon Client               │
│  ┌────────────────────────────────────────────┐  │
│  │          Security Guard UI                  │  │
│  │  (React components in Electron app)         │  │
│  └─────────────────┬──────────────────────────┘  │
│                    │                              │
│  ┌─────────────────▼──────────────────────────┐  │
│  │       Security Guard Engine (local)         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │ Scanner  │ │ Scoring  │ │ Remediation│  │  │
│  │  │ Modules  │ │ Engine   │ │ Engine     │  │  │
│  │  └────┬─────┘ └────┬─────┘ └─────┬──────┘  │  │
│  │       │             │             │          │  │
│  │  ┌────▼─────────────▼─────────────▼──────┐  │  │
│  │  │        Result Aggregator               │  │  │
│  │  └────────────────┬───────────────────────┘  │  │
│  │                   │                          │  │
│  │  ┌────────────────▼───────────────────────┐  │  │
│  │  │  Audit Report Generator                │  │  │
│  │  └────────────────────────────────────────┘  │  │
│  └─────────────────┬──────────────────────────┘  │
│                    │                              │
│  ┌─────────────────▼──────────────────────────┐  │
│  │       SSH Execution Layer                   │  │
│  │  (Uses existing Carbon SSH conn)     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
          │ SSH │
          ▼     ▼
┌──────────────────┐
│  Target Machine  │
│  (Linux VPS)     │
└──────────────────┘
```

### 7.2 Modular Scanner System

Each security check is a self-contained module that follows a strict interface:

```typescript
interface ScannerModule {
  id: string;                      // e.g., "ssh-password-auth"
  name: string;                    // e.g., "SSH Password Authentication"
  category: ScanCategory;          // "ssh" | "firewall" | "services" | "packages" | "users" | "malware"
  severity: Severity;              // "critical" | "high" | "medium" | "low" | "info"
  description: string;             // Human-readable description of what this checks

  // Commands to execute on remote machine
  gatherCommands(): RemoteCommand[];

  // Parse command outputs into structured findings
  analyze(outputs: CommandOutputMap): ScanFinding[];

  // Return remediation actions if findings are negative
  remediate(findings: ScanFinding[]): RemediationAction[];

  // Dependencies on other modules (ordering)
  dependencies?: string[];

  // Supported OS/distro (skip if not applicable)
  supportedDistros?: string[];     // e.g., ["ubuntu", "debian", "centos", "rhel"]
}
```

**Module registration:**
```typescript
const scannerRegistry = new ScannerRegistry();
scannerRegistry.register(new SSHPasswordAuthScanner());
scannerRegistry.register(new SSHRootLoginScanner());
scannerRegistry.register(new FirewallStatusScanner());
scannerRegistry.register(new Fail2banScanner());
scannerRegistry.register(new DockerExposureScanner());
// ... etc
```

**Benefits of modular design:**
- Easy to add new checks without modifying existing code
- Each module is independently testable
- Modules can declare dependencies (e.g., "Docker checks" depends on "Docker detection")
- Modules can be enabled/disabled per scan profile
- Community-contributed modules in the future

### 7.3 SSH Command Execution Flow

```
1. Scanner module declares required commands:
   [
     { cmd: "cat /etc/ssh/sshd_config", timeout: 5000 },
     { cmd: "sshd -T 2>/dev/null", timeout: 5000 },
     { cmd: "ss -tlnp", timeout: 5000 }
   ]

2. Execution optimizer batches commands:
   - Group independent commands for parallel execution
   - Respect dependencies (some commands depend on prior output)
   - Apply timeouts per command
   - Apply global scan timeout (60s default)

3. Commands execute over existing SSH connection:
   - Reuse Carbon's SSH session (no new auth needed)
   - Execute via non-interactive shell
   - Capture stdout, stderr, exit code

4. Error handling:
   - Command not found → skip gracefully, note in findings
   - Permission denied → try with sudo if available, note in findings
   - Timeout → abort command, continue with partial results
   - Connection lost → abort scan, preserve partial results
```

**Command safety rules:**
- NEVER run commands that modify state during a scan (read-only)
- NEVER pipe to `rm`, `dd`, `mkfs`, or any destructive command
- All commands are hardcoded strings — no dynamic command construction from external input
- Commands are audited and reviewed as part of the codebase

### 7.4 Config Parsers

Purpose-built parsers for Linux configuration files. NOT regex-only — must handle the actual grammar of each config format.

| Config File | Parser Requirements |
|-------------|-------------------|
| `sshd_config` | Handle `Include` directives, `Match` blocks, comments, multi-value directives |
| `ufw` rules | Parse `/etc/ufw/user.rules` and `/etc/ufw/user6.rules` |
| `iptables-save` output | Parse chains, rules, targets, comments |
| `fail2ban` jail config | INI format with jail sections, handle `jail.local` overriding `jail.conf` |
| `/etc/passwd` | Standard colon-delimited, identify system vs. human users |
| `/etc/sudoers` | Handle aliases, user specs, defaults, `#include` and `#includedir` |
| `docker/daemon.json` | Standard JSON, handle missing file gracefully |
| `sysctl.conf` | Key=value format, handle `.d/` directory overrides |

### 7.5 Result Aggregation

All scanner module outputs are collected into a unified report structure:

```typescript
interface SecurityReport {
  machine: MachineInfo;            // hostname, IP, OS, kernel version
  scanTimestamp: string;
  scanDuration: number;            // milliseconds
  score: number;                   // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    passed: number;
  };
  findings: ScanFinding[];
  remediations: RemediationAction[];
  metadata: {
    scannersRun: string[];
    scannersSkipped: { id: string; reason: string }[];
    errors: ScanError[];
  };
}

interface ScanFinding {
  id: string;
  scannerId: string;
  severity: Severity;
  title: string;                   // "Password authentication is enabled"
  description: string;             // Detailed explanation
  evidence: string;                // The actual config line or command output
  remediation?: string;            // Short remediation description
  references?: string[];           // CVE IDs, documentation URLs
  passed: boolean;                 // true if check passed (no issue found)
}
```

### 7.6 Severity Scoring

Severity is NOT subjective. Each finding maps to a defined severity based on:

| Factor | Critical | High | Medium | Low |
|--------|----------|------|--------|-----|
| Remote exploitable without auth? | Yes | Sometimes | No | No |
| Leads to root/full compromise? | Yes | Possibly | No | No |
| Actively exploited in the wild? | Yes | Yes | Unknown | No |
| Affects default installations? | Yes | Yes | Sometimes | No |
| Fix requires service restart? | N/A | N/A | Yes | No |

### 7.7 Remediation Engine

The remediation engine translates findings into executable actions:

```typescript
interface RemediationAction {
  id: string;
  findingId: string;
  title: string;
  description: string;
  commands: RemediationCommand[];
  rollbackCommands: RemediationCommand[];
  requiresSudo: boolean;
  requiresReboot: boolean;
  requiresServiceRestart: string[];  // service names
  dangerLevel: "safe" | "moderate" | "dangerous";
  estimatedDuration: number;         // seconds
  preflightChecks: PreflightCheck[];  // conditions that must be true before executing
}

interface RemediationCommand {
  command: string;
  description: string;
  timeout: number;
  expectedExitCode: number;
  onFailure: "abort" | "warn" | "skip";
}

interface PreflightCheck {
  description: string;
  command: string;
  expectedOutput: string | RegExp;
  failureMessage: string;
}
```

**Example — disabling password authentication:**

```typescript
{
  id: "rem-ssh-disable-password-auth",
  findingId: "ssh-password-auth-enabled",
  title: "Disable SSH password authentication",
  commands: [
    {
      command: "grep -c 'AuthorizedKeysFile' /etc/ssh/sshd_config",
      description: "Verify authorized_keys is configured"
    },
    {
      command: "ls ~/.ssh/authorized_keys 2>/dev/null && echo 'EXISTS'",
      description: "Verify SSH keys exist for current user"
    },
    {
      command: "sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config",
      description: "Set PasswordAuthentication to no"
    },
    {
      command: "sshd -t",
      description: "Validate sshd configuration"
    },
    {
      command: "systemctl reload sshd",
      description: "Reload SSH daemon"
    }
  ],
  preflightChecks: [
    {
      description: "At least one SSH key must exist for current user",
      command: "test -f ~/.ssh/authorized_keys && wc -l < ~/.ssh/authorized_keys",
      expectedOutput: /^[1-9]/,
      failureMessage: "No SSH keys found. Disabling password auth would lock you out."
    }
  ]
}
```

### 7.8 Audit Report Generator

Generates human-readable and machine-readable reports:

**Formats:**
- **Dashboard view** (primary) — rendered in Carbon UI
- **Markdown report** — exportable, shareable
- **JSON report** — machine-readable, for integration with other tools
- **PDF report** — for compliance/audit documentation (future)

**Report contents:**
1. Executive summary (score, grade, critical findings count)
2. Machine information (OS, kernel, uptime, IP, SSH version)
3. Findings by category (SSH, Firewall, Services, Packages, Users, Malware)
4. Each finding with severity, evidence, and remediation
5. Comparison with previous scan (if available)
6. Recommended next steps prioritized by impact

---

## 8. Multi-Machine Support

### 8.1 Architecture

Since Carbon already manages multiple SSH connections, Security Guard extends this with:

```
┌──────────────────────────────────────────┐
│          Fleet Security View              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ web-01  │ │ web-02  │ │ db-01   │   │
│  │ Score:A │ │ Score:A │ │ Score:C │   │
│  │ ✓       │ │ ✓       │ │ ⚠ 3     │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐               │
│  │ gpu-01  │ │ staging │               │
│  │ Score:B │ │ Score:F │               │
│  │ ⚠ 1     │ │ ✗ 12    │               │
│  └─────────┘ └─────────┘               │
└──────────────────────────────────────────┘
```

### 8.2 Grouped Security Policies

Users can define policy groups:

```typescript
interface SecurityPolicyGroup {
  name: string;                    // "Production Web Servers"
  machines: string[];              // machine IDs
  requiredProtocol: string;        // "production-server"
  minimumScore: number;            // 75
  requiredFindings: {
    maxCritical: number;           // 0
    maxHigh: number;               // 2
  };
  scanSchedule: string;            // cron expression, e.g., "0 6 * * 1" (weekly Monday 6am)
  alertOnDrift: boolean;
}
```

### 8.3 Drift Detection

Drift detection compares the current state of a machine against its last known-good state or its policy requirements:

**What constitutes drift:**
- Security score decreased since last scan
- A previously-fixed finding has reappeared (e.g., someone re-enabled password auth)
- New packages installed with known CVEs
- Firewall rules changed
- New users added
- New listening ports detected
- sshd_config modified since last hardening

**Implementation:**
- Store the full scan result for each machine
- On rescan, diff against the previous result
- Categorize changes: new findings, resolved findings, changed findings
- Alert on regressions (resolved → reappeared)

### 8.4 Compliance Comparison

Compare machines against each other or against a baseline:

| Check | web-01 | web-02 | db-01 | gpu-01 |
|-------|--------|--------|-------|--------|
| Password auth disabled | ✓ | ✓ | ✗ | ✓ |
| Firewall active | ✓ | ✓ | ✓ | ✗ |
| Fail2ban running | ✓ | ✓ | ✗ | ✓ |
| Root login disabled | ✓ | ✓ | ✓ | ✓ |
| Unattended upgrades | ✓ | ✗ | ✗ | ✓ |
| **Score** | **92** | **85** | **58** | **78** |

This matrix view instantly shows which machines are outliers and what specific checks they're failing.

### 8.5 Fleet-Wide Actions

Apply remediations across multiple machines:

1. **Batch scan** — Scan all machines in a group simultaneously
2. **Batch remediate** — Apply the same fix to multiple machines (e.g., "disable password auth on all web servers")
3. **Rolling update** — Apply changes one machine at a time with health checks between each
4. **Policy enforcement** — Automatically flag or remediate machines that fall below policy requirements

**Safety for fleet actions:**
- Always show a preview of affected machines before execution
- Execute sequentially by default (parallel opt-in)
- Stop on first failure (configurable: stop, warn-and-continue, skip-and-continue)
- Per-machine rollback capability

---

## 9. UI/UX Plan

### 9.1 Design Principles

- **Terminal-native feel.** Security Guard lives inside a terminal app. The UI should feel like a premium terminal tool, not a web dashboard awkwardly shoved into an Electron app.
- **Progressive disclosure.** Show the score and critical findings first. Details on demand.
- **Action-oriented.** Every finding has a clear "Fix" button. No dead-end information.
- **Dark by default.** Matches the terminal aesthetic. Security tools should look serious.

### 9.2 Onboarding Flow

```
Step 1: User connects to a machine via SSH (existing flow)

Step 2: Security Guard icon/button appears in the sidebar or top bar
        Tooltip: "Run a security scan on this machine"

Step 3: First-time click shows a brief explanation:
        "Security Guard will run read-only checks on your server.
         No changes will be made. The scan takes ~30 seconds."
        [Scan Now]  [Learn More]

Step 4: Scan runs with live progress:
        ✓ SSH configuration ............. 3 findings
        ✓ Firewall status ............... 1 finding
        ◉ Fail2ban ...................... scanning
        ○ Package vulnerabilities ....... pending
        ○ User permissions .............. pending
        ○ Docker security ............... pending
        ○ Malware scan .................. pending

Step 5: Results appear with score prominently displayed
```

### 9.3 First Scan Experience

The first scan must be fast, informative, and non-threatening:

```
┌─────────────────────────────────────────────────┐
│  SECURITY SCAN COMPLETE                         │
│                                                 │
│  ┌──────────┐                                   │
│  │          │  Score: 34 / 100                  │
│  │    F     │  Grade: F — Critical Risk         │
│  │          │                                   │
│  └──────────┘  7 critical · 3 high · 2 medium   │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  🔴 CRITICAL                                    │
│  ├── No firewall active                [Fix]    │
│  ├── Root login with password enabled  [Fix]    │
│  ├── SSH password auth enabled         [Fix]    │
│  └── Docker daemon exposed on TCP      [Fix]    │
│                                                 │
│  🟠 HIGH                                        │
│  ├── No fail2ban installed             [Fix]    │
│  ├── Weak SSH ciphers allowed          [Fix]    │
│  └── No unattended security upgrades   [Fix]    │
│                                                 │
│  🟡 MEDIUM                                      │
│  ├── SSH on default port 22            [Fix]    │
│  └── NOPASSWD sudo for user 'deploy'  [Info]   │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  [🔒 Fix All Critical]  [🛡️ Run Lockdown]       │
│  [📄 Export Report]     [💬 Ask AI]              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 9.4 Security Dashboard

For users with multiple machines, a dashboard view:

```
┌─────────────────────────────────────────────────┐
│  SECURITY DASHBOARD          Last scan: 2h ago  │
│                                                 │
│  Fleet Score: 68 / 100  (C — Needs Improvement) │
│                                                 │
│  ┌─────────┬─────────┬─────────┬─────────┐     │
│  │ web-01  │ web-02  │ db-01   │ staging │     │
│  │ A  (92) │ A  (87) │ C  (58) │ F  (23) │     │
│  │ 0 crit  │ 0 crit  │ 2 crit  │ 7 crit  │     │
│  └─────────┴─────────┴─────────┴─────────┘     │
│                                                 │
│  ⚠ 2 machines below policy threshold            │
│  ⚠ Drift detected on db-01 since last scan      │
│  ⚠ 3 new CVEs affect packages on web-01, web-02 │
│                                                 │
│  [Scan All]  [View Compliance Matrix]            │
└─────────────────────────────────────────────────┘
```

### 9.5 Risk Heatmap

Visual representation of risk across categories and machines:

```
              SSH    Firewall  Services  Packages  Users  Docker
  web-01     🟢      🟢        🟢        🟡        🟢     —
  web-02     🟢      🟢        🟡        🟡        🟢     —
  db-01      🔴      🟢        🟡        🔴        🟡     —
  staging    🔴      🔴        🔴        🔴        🔴     🔴
```

### 9.6 Actionable Fix Flows

When user clicks "Fix" on a finding:

```
┌─────────────────────────────────────────────────┐
│  FIX: Disable SSH Password Authentication       │
│                                                 │
│  What this does:                                │
│  Sets PasswordAuthentication to "no" in         │
│  /etc/ssh/sshd_config and reloads the SSH       │
│  daemon.                                        │
│                                                 │
│  After this change, only SSH key authentication │
│  will be allowed. Password login will be        │
│  disabled.                                      │
│                                                 │
│  Pre-flight checks:                             │
│  ✓ SSH key found for user 'deploy'              │
│  ✓ SSH key found for user 'admin'               │
│  ✓ Backup of sshd_config created                │
│  ✓ Watchdog timer armed (60s auto-rollback)     │
│                                                 │
│  Commands to execute:                           │
│  ┌───────────────────────────────────────────┐  │
│  │ sed -i 's/^#\?PasswordAuthentication.*/   │  │
│  │ PasswordAuthentication no/'               │  │
│  │ /etc/ssh/sshd_config                      │  │
│  │                                           │  │
│  │ sshd -t && systemctl reload sshd          │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [Apply Fix]  [Cancel]  [Ask AI about this]     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 9.7 "Fix All" Flow

When user clicks "Fix All Critical":

```
┌─────────────────────────────────────────────────┐
│  FIX ALL CRITICAL FINDINGS                      │
│                                                 │
│  4 critical findings will be remediated:        │
│                                                 │
│  1. ✓ Enable firewall (UFW)                     │
│  2. ✓ Disable root SSH login                    │
│  3. ✓ Disable SSH password authentication       │
│  4. ⚠ Secure Docker daemon (requires restart)   │
│                                                 │
│  ⚠ WARNING: Fix #4 will restart the Docker      │
│  daemon. Running containers will be briefly     │
│  interrupted.                                   │
│                                                 │
│  Execution order has been optimized for safety. │
│  Each fix includes automatic rollback if it     │
│  fails. Full session rollback available after.  │
│                                                 │
│  Estimated time: ~45 seconds                    │
│                                                 │
│  [Apply All 4 Fixes]  [Select Individual Fixes] │
│  [Cancel]                                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 9.8 Confirmation & Rollback UI

After fixes are applied:

```
┌─────────────────────────────────────────────────┐
│  HARDENING COMPLETE                             │
│                                                 │
│  4 of 4 fixes applied successfully              │
│  New score: 78 / 100 (B — Good)  ↑44 points    │
│                                                 │
│  ✓ Firewall enabled (UFW)                       │
│  ✓ Root SSH login disabled                      │
│  ✓ Password authentication disabled             │
│  ✓ Docker daemon secured                        │
│                                                 │
│  Remaining issues: 3 high, 2 medium             │
│                                                 │
│  ⟲ Rollback available for 30 days               │
│  [Undo All Changes]  [Undo Specific Changes]    │
│  [Continue Hardening]  [Export Report]           │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 9.9 Terminal Integration

Security Guard findings can appear inline in the terminal:

- When user types `ssh root@...` → subtle warning: "Running as root. Security Guard recommends a non-root user."
- When user types `ufw disable` → warning: "This will disable your firewall. Security Guard score will decrease."
- After package installation → "New package installed. Run a security scan to check for known vulnerabilities."

These are non-blocking suggestions, never interrupting workflow.

---

## 10. Technical Stack Suggestions

### 10.1 Languages

| Component | Language | Rationale |
|-----------|----------|-----------|
| Scanner engine | TypeScript | Already the codebase language. Scanner modules are data-processing logic, no need for lower-level language |
| Config parsers | TypeScript | Custom parsers for each config format. Can use `nearley` or hand-written recursive descent for complex ones (sshd_config, sudoers) |
| Remediation scripts | Shell (bash) | Commands must be shell commands. Templates stored as strings in TypeScript modules |
| UI | React + TypeScript | Existing Carbon stack |
| AI layer | TypeScript | API calls to LLM provider |

### 10.2 Scanning Libraries & Tools (Executed on Remote Machine)

| Tool | Purpose | Notes |
|------|---------|-------|
| `ss` / `netstat` | List listening ports and connections | `ss` preferred (modern, faster) |
| `iptables-save` / `nft list` | Dump firewall rules | Parse output client-side |
| `dpkg -l` / `rpm -qa` | List installed packages | For CVE cross-referencing |
| `apt list --upgradable` | Find packages with updates | Ubuntu/Debian |
| `sshd -T` | Dump effective sshd config | Resolves all includes and match blocks |
| `chkrootkit` | Basic rootkit detection | Optional, install on demand with user consent |
| `rkhunter` | Rootkit/malware detection | Optional, more thorough than chkrootkit |
| `ausearch` / `aureport` | Audit log analysis | If auditd is installed |
| `docker info` / `docker ps` | Docker state inspection | If Docker is installed |
| `systemctl list-units` | Service enumeration | Detect running services for firewall rule suggestions |

### 10.3 CVE Databases

| Source | Type | Usage |
|--------|------|-------|
| Ubuntu USN (Ubuntu Security Notices) | Free API | Map installed .deb packages to known CVEs |
| Debian Security Tracker | Free API | Debian-based distro CVE data |
| NIST NVD (National Vulnerability Database) | Free API | Comprehensive CVE database, rate-limited |
| OSV (Open Source Vulnerabilities) | Free API | Google's aggregated vulnerability database, good API |
| `apt-cache policy` + changelog | Local | Quick check for security-relevant updates |

**Recommended approach:** Use OSV as the primary source (good API, fast, aggregated). Fall back to distro-specific sources for accuracy. Cache results aggressively (CVE data doesn't change often).

### 10.4 SSH Libraries

Carbon already has SSH connectivity. Security Guard should reuse the existing SSH session.

**Execution model:**
```
Security Guard Engine
    │
    ▼
Carbon SSH Session (already authenticated)
    │
    ▼
Execute commands via SSH channel
    │
    ▼
Parse output in TypeScript
```

No additional SSH library needed. The scanner sends commands through the existing session.

If background scanning is needed (scanning without an active terminal), consider:
- `ssh2` (Node.js SSH client library) for programmatic SSH sessions
- Connection pooling for multi-machine fleet scans

### 10.5 Local vs. Remote Execution Strategy

| Operation | Where | Why |
|-----------|-------|-----|
| Running scan commands | Remote (target machine) | Commands must run where the OS is |
| Parsing command output | Local (Carbon client) | Keeps parser logic in TypeScript, no agent installation required |
| CVE database lookup | Local (with caching) | No need to install anything on the target |
| AI analysis | Local → cloud LLM API | Scan results sent to LLM for explanation (with user consent) |
| Remediation execution | Remote (target machine) | Commands must run where the OS is |
| Report generation | Local | Rich rendering in Electron |
| Backup storage | Remote + local cache | Backups live on the target, optionally cached locally |

**Key decision: No remote agent installation.** Security Guard runs entirely over SSH commands. This means:
- Zero footprint on the target machine (except backups in `/var/lib/carbon/`)
- Works with any SSH-accessible Linux machine
- No daemon to maintain, update, or secure
- Slightly slower than a local agent (SSH round-trip per command batch), but fast enough (~30s for full scan)

---

## 11. Security Risks & Liability

### 11.1 Risks of Automated Hardening

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SSH lockout from config change | Medium | **Critical** | Watchdog timer, parallel session, pre-flight key verification |
| Firewall blocks application traffic | Medium | High | Detect running services before enabling, allow known ports |
| Package update breaks application | Low | High | Security updates only (not full upgrades), user confirmation |
| Docker restart kills running containers | Medium | Medium | Explicit warning, user confirmation, `live-restore` enabled |
| Fail2ban bans legitimate users | Low | Medium | Sane defaults (high max retries), whitelist guidance |
| Disabling necessary service | Low | Medium | Only disable known-unnecessary services, never auto-disable without confirmation |
| False sense of security | Medium | High | Clear messaging: "This addresses common misconfigurations. It does not make your server impenetrable." |

### 11.2 Legal/Security Concerns

**Data handling:**
- Scan results may contain sensitive information (usernames, IP addresses, software versions, firewall rules)
- If AI analysis is used, scan data is sent to an LLM provider — requires explicit user consent
- Option for fully offline scanning (no AI, no external API calls) must exist
- Never log or transmit SSH credentials, private keys, or passwords

**Liability:**
- Clear terms of service: "Security Guard is a tool, not a guarantee. Use at your own risk."
- Disclaimer before every hardening action: "This will modify your server configuration."
- Users must explicitly opt-in to every change (or explicitly enable a lockdown protocol)
- Audit logs provide evidence of what was done and when

**Compliance:**
- Avoid making compliance claims (PCI-DSS, SOC 2, HIPAA) in the MVP. These require certification.
- Frame Security Guard as "helps you work toward compliance" not "makes you compliant."

### 11.3 Dangerous Commands — The Blocklist

These commands must NEVER be generated or executed by Security Guard, even in remediation scripts:

```
rm -rf /                    # Obvious
dd if=/dev/zero of=...      # Disk wipe
mkfs.*                      # Filesystem creation
:(){ :|:& };:               # Fork bomb
chmod -R 777 /              # Permission destruction
iptables -F (without save)  # Firewall flush (lockout)
kill -9 1                   # Kill init
echo "" > /etc/passwd       # Destroy user database
shutdown / reboot            # Unless explicitly requested
```

### 11.4 User Consent Model

**Three-tier consent:**

1. **Scan consent** (low bar): "Security Guard will run read-only checks on your server. No changes will be made."
   - Required before first scan
   - Remembered for the connection

2. **Remediation consent** (per-action): "The following change will be made to your server: [description]. [Apply] [Cancel]"
   - Required for every modification
   - Shows exact commands
   - Shows rollback availability

3. **Lockdown consent** (high bar): "The [Protocol Name] lockdown will make [N] changes to your server. This includes: [list]. All changes are reversible."
   - Required for protocol execution
   - Shows complete action list
   - Requires explicit confirmation (not just clicking a button — type "CONFIRM" or similar)

**AI data consent:** Separate opt-in for sending scan data to LLM for analysis. Must be independently togglable. Scanning works without AI.

---

## 12. Competitive Analysis

### 12.1 Comparison Matrix

| Feature | Carbon Security Guard | Warp | Termius | Cockpit | Lynis | CrowdSec | Fail2ban |
|---------|------------------------------|------|---------|---------|-------|----------|----------|
| **SSH security audit** | ✓ Comprehensive | ✗ | ✗ | Partial | ✓ Comprehensive | ✗ | ✗ |
| **One-click hardening** | ✓ With rollback | ✗ | ✗ | ✗ | ✗ (report only) | ✗ | ✗ |
| **Firewall management** | ✓ Detect + configure | ✗ | ✗ | ✓ Basic | ✓ Audit only | ✗ | ✗ |
| **CVE scanning** | ✓ Package-level | ✗ | ✗ | ✗ | ✓ Basic | ✗ | ✗ |
| **AI explanations** | ✓ Context-aware | ✓ Generic AI | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Rollback system** | ✓ Full | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Multi-machine** | ✓ Fleet view | ✗ | ✓ Connection manager | ✗ Single machine | ✗ | ✓ Network-wide | ✗ |
| **Security scoring** | ✓ 0-100 + grade | ✗ | ✗ | ✗ | ✓ Hardening index | ✗ | ✗ |
| **Drift detection** | ✓ | ✗ | ✗ | ✗ | ✓ With cron | ✗ | ✗ |
| **Integrated in terminal** | ✓ Native | ✗ | ✗ | ✗ Web UI | ✗ CLI only | ✗ CLI/Web | ✗ CLI only |
| **No agent required** | ✓ SSH only | N/A | N/A | ✗ Agent | ✗ Install on host | ✗ Agent | ✗ Install on host |
| **Target audience** | Developers | Developers | DevOps | Sysadmins | Security pros | Security pros | Sysadmins |

### 12.2 Gap Analysis

**Warp:**
- Has AI command suggestions but zero security features
- Focused on local terminal productivity, not remote server management
- No SSH-specific tooling
- **Gap:** Warp users who deploy to VPS have no security help

**Termius:**
- Excellent SSH client with connection management
- Has SFTP, port forwarding, snippets
- Zero security auditing or hardening
- **Gap:** Manages connections but doesn't help secure what's on the other end

**Cockpit:**
- Web-based server management UI
- Has basic firewall management, service management, user management
- Requires installation on the server
- No automated hardening, no security scoring, no AI
- **Gap:** Requires sysadmin knowledge to interpret and act on information

**Lynis:**
- The gold standard for Linux security auditing
- Extremely comprehensive (200+ tests)
- CLI only, no UI, no remediation
- Output is a wall of text — overwhelming for non-security-engineers
- Must be installed on the target machine
- **Gap:** Tells you everything that's wrong but doesn't fix anything. Requires security expertise to interpret.

**CrowdSec:**
- Collaborative intrusion prevention (community-powered IP blocklists)
- Real-time threat detection
- Requires agent installation and ongoing management
- Not focused on configuration hardening
- **Gap:** Prevents attacks but doesn't fix misconfigurations that make attacks possible

**Fail2ban:**
- Brute-force protection only
- Single purpose (ban IPs after failed auth)
- No broader security auditing
- Complex configuration for non-sysadmins
- **Gap:** One piece of the puzzle, not a solution

### 12.3 Differentiation Strategy

Carbon Security Guard occupies a unique position:

1. **Integrated into the workflow.** You're already connected via SSH. Security is one click away, not a separate tool to install and learn.
2. **Action-oriented.** Lynis tells you what's wrong. We fix it.
3. **Rollback-safe.** No other tool offers comprehensive rollback for security hardening.
4. **Developer-friendly.** Written for developers who know they should secure their servers but don't know how. Not for CISOs or security engineers.
5. **No agent needed.** Works over SSH. No software to install on the target (except optional packages like fail2ban, which we install as part of hardening).
6. **AI where it helps, deterministic where it matters.** AI explains findings and helps prioritize. Scanning and hardening are deterministic and auditable.

---

## 13. Monetization Opportunities

### 13.1 Free Tier

| Feature | Free |
|---------|------|
| Security scan (all checks) | ✓ Unlimited |
| Security score | ✓ |
| Individual fix actions | ✓ Up to 5 per machine |
| Manual remediation guidance | ✓ |
| Markdown report export | ✓ |

### 13.2 Pro Tier (Individual)

| Feature | Pro |
|---------|-----|
| Everything in Free | ✓ |
| One-click lockdown protocols | ✓ |
| Unlimited fix actions | ✓ |
| AI-powered explanations | ✓ |
| CVE scanning with context | ✓ |
| Drift detection | ✓ |
| Scheduled scans | ✓ |
| Up to 10 machines | ✓ |
| Full rollback system | ✓ |

### 13.3 Team Tier

| Feature | Team |
|---------|------|
| Everything in Pro | ✓ |
| Unlimited machines | ✓ |
| Fleet dashboard | ✓ |
| Compliance comparison matrix | ✓ |
| Grouped security policies | ✓ |
| Team audit logs | ✓ |
| Shared security baselines | ✓ |
| Role-based access (who can remediate) | ✓ |
| PDF compliance reports | ✓ |
| Priority support | ✓ |

### 13.4 Enterprise (Future)

| Feature | Enterprise |
|---------|-----------|
| Everything in Team | ✓ |
| Custom scanner modules | ✓ |
| Custom lockdown protocols | ✓ |
| API access for CI/CD integration | ✓ |
| SSO/SAML integration | ✓ |
| Compliance frameworks (CIS, SOC 2 prep) | ✓ |
| Dedicated support | ✓ |
| On-premise deployment option | ✓ |
| SLA guarantees | ✓ |

### 13.5 Monetization Notes

- **Free tier must be genuinely useful.** If free users can scan and see their problems, they'll pay to fix them easily.
- **AI is a natural paywall.** Scanning is deterministic (cheap to run). AI explanations cost API tokens.
- **Fleet features are the enterprise hook.** Individual developers pay for convenience. Teams pay for visibility and compliance.
- **Avoid per-scan pricing.** Users should scan frequently. Don't create incentives to scan less.

---

## 14. Long-Term Vision (3–5 Years)

### Phase: Near-Term (6–12 months post-MVP)

**Autonomous Remediation:**
- "Set it and forget it" mode for trusted environments
- User defines a policy, Security Guard auto-remediates any drift
- Strict constraints: only pre-approved actions, never on production without confirmation
- Requires high trust level — earn it through months of reliable manual remediation

**Continuous Monitoring:**
- Lightweight periodic scanning (not just on-demand)
- Auth log monitoring for brute-force detection
- Process monitoring for cryptominer detection
- File integrity monitoring for `/etc/` changes

### Phase: Medium-Term (1–2 years)

**Intrusion Detection:**
- Monitor SSH auth logs in real-time
- Detect anomalous login patterns (new source IP, unusual time, multiple failed attempts)
- Alert on suspicious process activity
- File integrity monitoring (tripwire-like)
- Network connection anomaly detection

**Live Attack Response:**
- If an active brute-force attack is detected, offer to:
  - Temporarily ban the source IP range
  - Tighten fail2ban parameters
  - Add rate limiting
  - Enable geo-blocking

**AI SOC (Security Operations Center) Assistant:**
- "What happened on my server last night?"
- "Show me all failed SSH logins in the last 24 hours and correlate with successful logins from the same IPs"
- "Is this process legitimate?" (with context from package databases and known good baselines)

### Phase: Long-Term (2–5 years)

**Self-Healing Infrastructure:**
- Machine detects its own compromise → auto-isolates → alerts → provides forensic data
- Requires a lightweight agent (departure from SSH-only model, opt-in)
- Automatic security patch application with canary testing

**Cloud Provider Integrations:**
- AWS Security Groups sync
- DigitalOcean Firewall management
- GCP VPC firewall rules
- Azure NSG management
- Cloud-level + OS-level security viewed together

**Kubernetes Support:**
- RBAC auditing
- Network policy analysis
- Pod security standards enforcement
- Container image vulnerability scanning
- Secrets management audit

**Zero-Trust Infrastructure:**
- SSH certificate-based authentication (no more authorized_keys management)
- Short-lived credentials
- Identity-aware access policies
- BeyondCorp-style access model for SSH

**Compliance Automation:**
- CIS Benchmark scanning (Ubuntu, Debian, RHEL, CentOS)
- SOC 2 evidence collection
- PCI-DSS self-assessment support
- Automated compliance reports for auditors
- Continuous compliance monitoring

---

## 15. Development Roadmap

### Phase 1: Foundation (Weeks 1–6)

**Goal:** Deliver a working security scan with score and basic reporting.

| Feature | Complexity | Dependencies | Impact |
|---------|-----------|-------------|--------|
| Scanner module framework | Medium | None | Foundation for everything |
| SSH command execution layer | Low | Existing SSH connection | Foundation |
| sshd_config parser | Medium | Scanner framework | Core check |
| SSH security checks (root login, password auth, port, ciphers) | Low | sshd_config parser | High-value findings |
| Firewall detection and parsing | Medium | Scanner framework | Critical finding |
| Security score calculation | Low | Scanner framework | Key UX element |
| Basic results UI (findings list + score) | Medium | Scanner framework, React | User-facing value |
| Markdown report export | Low | Scanner framework | Shareability |

**Deliverable:** User can connect to a machine, run a scan, see their score and findings, and export a report. No remediation yet.

**Estimated effort:** 2 engineers, 6 weeks.

### Phase 2: Remediation (Weeks 7–12)

**Goal:** Enable users to fix findings with one click, safely.

| Feature | Complexity | Dependencies | Impact |
|---------|-----------|-------------|--------|
| Rollback system (snapshots, manifests, undo) | High | Phase 1 | Critical safety net |
| Remediation engine | High | Scanner framework, rollback system | Core product value |
| Pre-flight checks | Medium | Remediation engine | Safety |
| SSH config change watchdog | Medium | Remediation engine | Prevent lockouts |
| Individual "Fix" buttons in UI | Medium | Remediation engine, UI | User-facing value |
| Fail2ban scanner + installer | Low | Scanner framework | Common finding |
| UFW scanner + setup | Medium | Scanner framework, remediation | Common finding |
| Unattended upgrades scanner + setup | Low | Scanner framework | Quick win |
| Fix confirmation dialogs | Low | UI | Trust |
| Rollback UI | Medium | Rollback system, UI | Safety UX |

**Deliverable:** User can scan and fix individual findings with rollback support. The "Fix" button works.

**Estimated effort:** 2–3 engineers, 6 weeks.

### Phase 3: Protocols & AI (Weeks 13–20)

**Goal:** Lockdown protocols and AI-powered explanations.

| Feature | Complexity | Dependencies | Impact |
|---------|-----------|-------------|--------|
| Lockdown protocol engine | High | Remediation engine | Key differentiator |
| Personal VPS protocol | Medium | Protocol engine | Most common use case |
| Production Server protocol | Medium | Protocol engine | High value |
| Docker Host protocol | High | Protocol engine, Docker scanner | Complex but needed |
| User/sudo permission scanner | Medium | Scanner framework | Important finding |
| Package vulnerability scanner (CVE integration) | High | Scanner framework, CVE API | High value |
| Basic malware/rootkit scan | Medium | Scanner framework | Reassurance |
| AI explanation layer (LLM integration) | Medium | Scan results, LLM API | Enhanced understanding |
| AI risk prioritization | Medium | AI layer, scan results | Better UX |
| "Fix All" flow UI | Medium | Remediation engine, UI | Efficiency |
| Lockdown consent UI | Low | Protocol engine, UI | Trust |

**Deliverable:** Users can run one-click lockdown protocols. AI explains findings. Package CVE scanning works.

**Estimated effort:** 3 engineers, 8 weeks.

### Phase 4: Fleet & Polish (Weeks 21–30)

**Goal:** Multi-machine support, drift detection, and production polish.

| Feature | Complexity | Dependencies | Impact |
|---------|-----------|-------------|--------|
| Multi-machine scan orchestration | High | Phase 1–3 | Scale |
| Fleet dashboard UI | High | Multi-machine, UI | Visibility |
| Security policy groups | Medium | Multi-machine | Governance |
| Drift detection | Medium | Scan history storage | Ongoing value |
| Compliance comparison matrix | Medium | Multi-machine, drift | Team value |
| Batch remediation | High | Multi-machine, remediation | Efficiency |
| Scheduled scanning | Medium | Multi-machine | Automation |
| AI GPU Machine protocol | Medium | Protocol engine | Niche but valuable |
| Startup SaaS Server protocol | Medium | Protocol engine | Common use case |
| Terminal inline warnings | Low | Terminal integration | Subtle UX |
| PDF report generation | Medium | Report engine | Enterprise need |
| Performance optimization | Medium | All | Polish |
| Security audit of Security Guard itself | High | All | Trust |

**Deliverable:** Full fleet management, drift detection, all lockdown protocols, polished UX. Production-ready feature.

**Estimated effort:** 3–4 engineers, 10 weeks.

---

## Appendix A: Open Questions

1. **Agent vs. agentless long-term.** SSH-only is the right MVP choice. But for continuous monitoring (log watching, process monitoring), an optional lightweight agent on the target may eventually be needed. When do we introduce this?

2. **Distro support scope.** MVP targets Ubuntu/Debian. When to add RHEL/CentOS/Rocky/Alma, Arch, Alpine? Each distro has different package managers, service managers, config locations.

3. **Container-first servers.** Some modern servers run everything in containers and have minimal host OS. How does Security Guard handle this? Should it scan container images too?

4. **Air-gapped environments.** If CVE scanning requires API access, what happens for servers behind restrictive firewalls? Need an offline CVE database option.

5. **Shared hosting / non-root access.** If the user doesn't have root/sudo, most hardening is impossible. How to handle gracefully? (Scan what we can, clearly mark what requires root.)

6. **Managed services.** AWS RDS, managed Kubernetes nodes, etc. don't allow SSH. Security Guard doesn't apply, but users might try. Need clear messaging.

## Appendix B: Threat Model for Security Guard Itself

Security Guard has root SSH access to user machines. It is itself a high-value target.

**Threats to mitigate:**
- Compromised Carbon client sending malicious commands → all commands are hardcoded, not dynamically generated
- Man-in-the-middle on SSH → use SSH host key verification (already handled by SSH protocol)
- Scan data exfiltration → scan data stays local unless user opts into AI analysis
- Supply chain attack on scanner modules → code review, signing, no dynamic module loading from external sources
- Backup data exposure → backups on target machine should have restrictive permissions (root only)

## Appendix C: Glossary

| Term | Definition |
|------|-----------|
| **Finding** | A single security observation (pass or fail) from a scanner module |
| **Remediation** | A specific action that fixes a finding |
| **Protocol** | A predefined bundle of remediations tailored to a server role |
| **Lockdown** | The act of executing a protocol (applying all its remediations) |
| **Drift** | A change in security posture since the last scan |
| **Rollback** | Reverting a remediation to restore the previous state |
| **Watchdog** | A background process that auto-reverts changes if connectivity is lost |
| **Fleet** | A group of machines managed together |
| **Scan** | A read-only security audit of a machine |
| **Score** | A 0–100 numerical representation of a machine's security posture |
