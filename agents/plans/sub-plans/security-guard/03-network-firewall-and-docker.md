# Network, Firewall, Fail2ban, And Docker

## Goal

Implement network exposure scanners and safe remediation planning for firewall state, UFW hardening, fail2ban, Docker daemon exposure, Docker socket risk, and common public service ports.

## Architectural Analysis

Network hardening has the same lockout risk as SSH hardening plus an additional trap: Linux firewall state is often split across UFW, iptables, nftables, firewalld, Docker-managed chains, and cloud-provider firewalls. Security Guard can safely handle the host OS layer for Ubuntu/Debian MVP, but it must not pretend to see provider-level controls unless an integration exists.

Docker is especially dangerous because UFW can look correct while Docker-published ports bypass it through iptables rules. The scanner should explicitly model "UFW enabled but Docker publishes directly" as a real risk state, not as a footnote.

Fail2ban is lower-risk to install/configure than firewall changes, but it still interacts with logs, systemd backends, and legitimate-user lockouts. Remediation should use sane defaults and clear whitelisting guidance.

## Dependencies

- Scan engine and host capability probe.
- SSH port scanner output.
- Remediation and rollback engine.
- Package installation policy for UFW/fail2ban.
- UI command preview and consent flows.

## Risks

- Enabling a firewall with missing SSH allow rule can lock out the user.
- Removing or overriding existing iptables/nft rules can break applications.
- Docker port publishing may bypass UFW and create false sense of protection.
- Fail2ban can ban legitimate users if configured too aggressively.
- Cloud firewalls may already protect the host, but Security Guard cannot reliably infer that without provider integration.

## Epics

### Epic: Firewall Backend Detection

#### Tasks

- [ ] Implement `network.firewall_backend` scanner.
  - [ ] Detect UFW availability and status.
  - [ ] Detect firewalld availability and state.
  - [ ] Detect raw iptables policies and open rules.
  - [ ] Detect nftables rulesets.
  - [ ] Detect likely Docker-managed chains.
- [ ] Normalize firewall state.
  - [ ] No firewall active.
  - [ ] UFW active.
  - [ ] firewalld active.
  - [ ] raw iptables/nftables active.
  - [ ] mixed/conflicting state.
  - [ ] unknown.
- [ ] Detect INPUT default policy and broad allow rules.
- [ ] Detect IPv6 coverage.
- [ ] Add cloud firewall caveat to scan results.

#### Acceptance Criteria

- No active host firewall produces a Critical finding unless explicitly downgraded by user-supplied cloud firewall context.
- Mixed firewall backends produce a warning and block one-click UFW remediation by default.
- IPv4 and IPv6 firewall states are reported separately where possible.

#### Rollback Plan

- Firewall remediation must snapshot rules before changes and preserve current SSH access.

#### Testing Requirements

- Fixtures for UFW inactive/active, default ACCEPT, nftables-only, iptables-only, Docker chains, and mixed UFW plus custom iptables.

### Epic: Exposed Service Detection

#### Tasks

- [ ] Implement listener scanner using `ss -tulpen` or safe fallback.
- [ ] Normalize listening sockets.
  - [ ] Protocol.
  - [ ] Local address.
  - [ ] Port.
  - [ ] Process name where permission allows.
  - [ ] Container relationship where detectable.
- [ ] Flag dangerous public bindings.
  - [ ] Docker daemon 2375/2376.
  - [ ] Databases such as 3306, 5432, 6379, 27017, 9200.
  - [ ] Admin panels and common development ports.
  - [ ] Services bound to `0.0.0.0` or `::`.
- [ ] Correlate listeners with firewall rules.
- [ ] Preserve application service discovery for UFW rule suggestions.

#### Acceptance Criteria

- Public database/admin exposure produces Critical or High findings with evidence.
- Localhost-only services are not incorrectly treated as internet-exposed.
- Findings explain uncertainty if process names are hidden by permissions.

#### Rollback Plan

- MVP should not auto-disable services. Offer firewall remediation first and manual guidance for service binding changes.

#### Testing Requirements

- Fixture tests for IPv4, IPv6, wildcard, localhost, Docker-published ports, and permission-limited `ss` output.

### Epic: UFW Setup And Hardening

#### Tasks

- [ ] Build UFW remediation plan generator.
  - [ ] Detect current SSH port from SSH scanner.
  - [ ] Add SSH allow rule before enabling UFW.
  - [ ] Add HTTP/HTTPS recommendations based on detected services.
  - [ ] Set default deny incoming and allow outgoing.
  - [ ] Enable UFW only after command preview and consent.
- [ ] Add preflight checks.
  - [ ] UFW package installed or installable.
  - [ ] Not conflicting with active firewalld/raw rules unless user explicitly accepts advanced path.
  - [ ] SSH port rule can be added.
  - [ ] `ufw --dry-run` or equivalent preview where available.
- [ ] Add post-change validation.
  - [ ] UFW active.
  - [ ] SSH connection still alive.
  - [ ] New parallel connection succeeds.
- [ ] Add rollback instructions for disabling UFW or restoring prior rules.

#### Acceptance Criteria

- UFW enablement cannot run unless SSH allow rule exists in the plan.
- Users see application ports that will remain closed unless selected.
- Existing custom rules are preserved or remediation is blocked.

#### Rollback Plan

- Snapshot UFW config and iptables/nft state before changes.
- Keep a watchdog that disables or restores UFW if connectivity validation fails.

#### Testing Requirements

- Fake executor tests for package missing, SSH port mismatch, dry-run failure, enable failure, and connectivity validation failure.

### Epic: Fail2ban Scanner And Remediation

#### Tasks

- [ ] Implement `network.fail2ban` scanner.
  - [ ] Detect installed package.
  - [ ] Detect service active state.
  - [ ] Parse `jail.local` and `jail.d`.
  - [ ] Verify `sshd` jail enabled.
  - [ ] Check `bantime`, `findtime`, and `maxretry`.
  - [ ] Detect backend and log path.
- [ ] Implement fail2ban remediation.
  - [ ] Install package if user consents.
  - [ ] Write minimal `sshd` jail override instead of overwriting broad config.
  - [ ] Enable and start service.
  - [ ] Validate `fail2ban-client status sshd`.
- [ ] Add whitelist guidance for known office/VPN IPs without requiring it for MVP.

#### Acceptance Criteria

- Missing fail2ban produces High finding for internet-facing SSH.
- Remediation writes a scoped config file and does not destroy existing jails.
- Legitimate-user lockout risk is called out in confirmation UI.

#### Rollback Plan

- Back up touched fail2ban files.
- Disable newly created jail or restore original config on rollback.

#### Testing Requirements

- Fixtures for absent package, inactive service, sshd jail disabled, weak settings, and existing custom jail config.

### Epic: Docker Exposure And Host Risk

#### Tasks

- [ ] Implement Docker daemon exposure scanner.
  - [ ] Parse `/etc/docker/daemon.json` for `tcp://` hosts.
  - [ ] Parse systemd overrides for `-H tcp://`.
  - [ ] Check listeners for 2375/2376.
  - [ ] Detect TLS usage where possible.
- [ ] Implement Docker socket and privilege scanner.
  - [ ] Check `/var/run/docker.sock` permissions.
  - [ ] List users in `docker` group.
  - [ ] List running containers when permitted.
  - [ ] Flag privileged containers.
  - [ ] Flag host networking.
  - [ ] Flag sensitive volume mounts such as `/`, `/etc`, and Docker socket.
- [ ] Implement Docker/UFW interaction scanner.
  - [ ] Detect Docker-published ports.
  - [ ] Warn when UFW is enabled but Docker publishes externally.
  - [ ] Recommend `ufw-docker` or explicit Docker iptables strategy as hardening work.

#### Acceptance Criteria

- Unauthenticated Docker TCP exposure produces Critical finding.
- Docker group membership is explained as root-equivalent.
- UFW bypass by Docker-published ports is visible in the dashboard and report.

#### Rollback Plan

- MVP should not auto-restart Docker or edit daemon configuration without a separate high-danger remediation path.
- Any future Docker daemon remediation must warn about container impact and support rollback.

#### Testing Requirements

- Fixtures for daemon JSON hosts, systemd override hosts, privileged containers, host networking, socket mount, docker group users, and UFW bypass.

