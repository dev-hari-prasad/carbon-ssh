# Suggestion Packs — Authoring Plan

## Goal

Create seven high-quality JSON suggestion packs covering the most common SSH terminal workflows: Linux core, systemd, apt, fail2ban, ufw, Docker, and Git. Each pack must pass Zod schema validation, include meaningful tokens and aliases for intent-based matching, and clearly label risk levels.

## Architectural Analysis

### Why Packs Are Separate From The Engine

Packs are **data, not code**. This separation is critical because:

1. **Non-engineers can author packs.** A sysadmin who knows fail2ban can write a pack without understanding TypeScript or scoring algorithms.
2. **Packs can be versioned independently.** A Docker pack update shouldn't require retesting the ranker.
3. **Runtime packs (Phase 4) require JSON-only data.** If packs contained code, loading user-supplied packs would be a code injection vector.
4. **Testing is declarative.** A pack either passes schema validation or it doesn't — no behavioral tests needed per-pack.

### Hidden Complexity

1. **Token quality determines ranking quality.** If a command has poor tokens, the ranker can't find it. Tokens are more important than aliases because they're weighted higher (0.20 token overlap vs 0.14 alias intent).
2. **Alias coverage determines intent matching.** A user typing `show ports` expects to find `ufw status` or `ss -tlnp`. Without these aliases, the engine returns nothing useful for natural-language-like queries.
3. **Risk labeling must be honest.** Labeling `apt upgrade` as `read` would be wrong — it modifies the system. The engine's risk penalty depends on accurate labels.
4. **Command templates affect argument scoring.** Using `<service>` consistently across packs means the argument scorer can recognize service names typed by the user. Using `SERVICE` or `{service}` instead would break argument detection.
5. **Duplicate command IDs across packs will fail validation.** A `git.status` in both a git pack and a linux pack would be rejected. IDs must be globally unique, so use `packId.command.subcommand` naming.

### Implementation Traps

- **Don't include every possible flag combination.** `docker run -it --rm --name <name> -v <volume> -p <port> <image>` is a common command, but each flag variation is a separate command entry. Include the most common patterns, not an exhaustive matrix.
- **Don't use overly generic tokens.** `["status"]` as the only token would match across systemd, docker, fail2ban, and ufw. Include the command name as the first token always (e.g., `["systemctl", "status"]`).
- **Don't forget that aliases are for natural language.** Aliases like `["show running services"]` or `["check firewall"]` are what make the engine useful beyond prefix completion. They must be written from the user's perspective, not the command's perspective.

## Dependencies

- `01-core-engine.md` — Zod schema must exist to validate packs during authoring
- No runtime dependencies — packs are static JSON

## Risks

- **Risk: Packs are too small to demonstrate value.** Mitigation: Aim for the command counts in the plan (40-60 Linux, 20-30 systemd, etc.). Quality > quantity, but a pack with 3 commands feels empty.
- **Risk: Tokens are inconsistent across packs.** Mitigation: Establish token conventions (see below) and validate consistency.
- **Risk: Missing aliases for common user intents.** Mitigation: For each command, ask "how would a user who doesn't remember the exact syntax describe this?" and add that as an alias.

## Token Conventions

All packs must follow these rules:

1. **First token = primary command name** (e.g., `systemctl`, `docker`, `git`, `apt`)
2. **Include subcommand names** (e.g., `status`, `restart`, `logs`, `commit`)
3. **Include natural-language action words** (e.g., `show`, `list`, `check`, `restart`, `remove`, `install`)
4. **Include domain keywords** (e.g., `firewall`, `service`, `container`, `package`, `branch`)
5. **All tokens lowercase**
6. **No argument templates in tokens** (no `<ip>`, `<service>`, etc.)
7. **Deduplicate across the command** (if `status` appears in both `tokens` and command string, it only needs to be in `tokens` once)

## Alias Conventions

1. **Write from the user's perspective** ("check ssh bans" not "fail2ban-client status sshd")
2. **Include both technical and casual phrasings** ("restart nginx" and "bounce the web server")
3. **Keep aliases short** (2-5 words)
4. **Include common misspellings or abbreviations** where helpful ("fw status" for firewall)
5. **Don't duplicate what tokens already cover** (if `restart` is a token, don't add `restart` as a standalone alias)

## Argument Template Conventions

1. **Use angle brackets**: `<ip>`, `<service>`, `<package>`, `<container>`, `<branch>`
2. **Use the `kind` field in `arguments` to specify type** for argument scoring
3. **Supported kinds**: `ipv4`, `port`, `path`, `service`, `package`, `container`, `branch`, `freetext`
4. **Mark arguments as `required: true` when the command is unusable without them**

## Epics

### Epic: Linux Core Pack

#### Tasks

- [ ] Create `src/features/suggestions/packs/linux.json`
  - [ ] Pack metadata: `packId: "linux"`, `domains: ["linux", "system"]`, `requires.os: ["linux"]`
  - [ ] Triggers: `["ls", "cd", "cat", "grep", "find", "ps", "kill", "chmod", "chown", "df", "du", "free", "top", "htop", "tar", "curl", "wget", "scp", "rsync", "tail", "head", "less", "sort", "uniq", "wc", "sed", "awk", "cut"]`
  - [ ] Target: 40-60 commands covering:
    - File system navigation and inspection (`ls`, `cd`, `cat`, `head`, `tail`, `less`, `find`, `tree`, `stat`)
    - File permissions (`chmod`, `chown`, `chgrp`)
    - Process management (`ps`, `kill`, `killall`, `top`, `htop`, `nice`, `nohup`)
    - Disk usage (`df`, `du`, `mount`, `lsblk`, `fdisk -l`)
    - Memory and system info (`free`, `uname`, `uptime`, `hostname`, `whoami`, `id`)
    - Text processing (`grep`, `sed`, `awk`, `sort`, `uniq`, `wc`, `cut`, `tr`, `diff`)
    - Archives (`tar`, `gzip`, `gunzip`, `zip`, `unzip`)
    - Network utilities (`curl`, `wget`, `scp`, `rsync`, `ssh`, `ping`, `traceroute`, `dig`, `nslookup`, `ss`, `netstat`)
    - Destructive commands (with `risk: "destructive"`): `rm -rf`, `dd`, `mkfs`
  - [ ] Ensure common aliases like `"show disk space"`, `"list processes"`, `"find files"`, `"check memory"`, `"show open ports"` are included

#### Acceptance Criteria

- Pack passes Zod schema validation
- All command IDs follow `linux.<category>.<action>` pattern
- Every command has at least 3 meaningful tokens
- At least 15 commands have natural-language aliases
- Destructive commands have `risk: "destructive"` and warning-oriented descriptions
- No duplicate command IDs

---

### Epic: systemd Pack

#### Tasks

- [ ] Create `src/features/suggestions/packs/systemd.json`
  - [ ] Pack metadata: `packId: "systemd"`, `domains: ["services", "linux"]`, `requires.os: ["linux"]`, `requires.commandsAny: ["systemctl"]`
  - [ ] Triggers: `["systemctl", "journalctl", "systemd"]`
  - [ ] Target: 20-30 commands covering:
    - Service lifecycle (`start`, `stop`, `restart`, `reload`, `enable`, `disable`, `mask`, `unmask`)
    - Status and inspection (`status`, `is-active`, `is-enabled`, `show`, `cat`)
    - System targets (`isolate`, `get-default`, `set-default`)
    - Timer units (`list-timers`)
    - Journal/logging (`journalctl -u <service>`, `journalctl -f`, `journalctl --since`, `journalctl -p err`)
    - Dependency inspection (`list-dependencies`)
    - Failed units (`--failed`, `reset-failed`)
  - [ ] Include `<service>` argument templates with `kind: "service"` and `required: true`
  - [ ] Risk levels: `restart`/`stop`/`mask` = `write`; `enable`/`disable` = `write`; `status`/`show`/`list` = `read`

#### Acceptance Criteria

- Pack passes Zod schema validation
- All command IDs follow `systemd.<area>.<action>` pattern
- Service management commands use `<service>` argument template
- `mask` and `disable` commands have clear descriptions warning about impact

---

### Epic: apt Pack

#### Tasks

- [ ] Create `src/features/suggestions/packs/apt.json`
  - [ ] Pack metadata: `packId: "apt"`, `domains: ["packages", "linux"]`, `requires.os: ["linux"]`, `requires.commandsAny: ["apt", "apt-get", "dpkg"]`
  - [ ] Triggers: `["apt", "apt-get", "dpkg", "package"]`
  - [ ] Target: 20-30 commands covering:
    - Package search and info (`apt search`, `apt show`, `apt list`, `apt list --installed`, `apt list --upgradable`)
    - Package install/remove (`apt install`, `apt remove`, `apt purge`, `apt autoremove`)
    - System update (`apt update`, `apt upgrade`, `apt full-upgrade`, `apt dist-upgrade`)
    - dpkg operations (`dpkg -l`, `dpkg -L <package>`, `dpkg -S <file>`, `dpkg --configure -a`)
    - Cache management (`apt clean`, `apt autoclean`)
    - Hold/unhold (`apt-mark hold`, `apt-mark unhold`, `apt-mark showhold`)
  - [ ] Risk levels: `install`/`remove`/`upgrade` = `write`; `purge`/`autoremove` = `destructive`; `search`/`show`/`list` = `read`; `update` = `network`

#### Acceptance Criteria

- Pack passes Zod schema validation
- All command IDs follow `apt.<area>.<action>` pattern
- `apt purge` and `apt autoremove` have `risk: "destructive"`
- `apt update` has `risk: "network"` (fetches from remote repos)
- Package name templates use `kind: "package"`

---

### Epic: fail2ban Pack

#### Tasks

- [ ] Create `src/features/suggestions/packs/fail2ban.json`
  - [ ] Pack metadata: `packId: "fail2ban"`, `domains: ["security", "linux"]`, `requires.os: ["linux"]`, `requires.commandsAny: ["fail2ban-client"]`
  - [ ] Triggers: `["fail2ban", "ban", "jail", "f2b"]`
  - [ ] Target: 10-20 commands covering:
    - Service status (`fail2ban-client status`, `fail2ban-client status sshd`, `fail2ban-client status <jail>`)
    - Ban management (`set <jail> banip <ip>`, `set <jail> unbanip <ip>`)
    - Jail management (`reload`, `start`, `stop`, `restart`)
    - Configuration inspection (`get <jail> bantime`, `get <jail> maxretry`, `get <jail> findtime`)
    - Banned IP listing (via `fail2ban-client status <jail>` output parsing)
    - Log tailing (`tail -f /var/log/fail2ban.log`)
  - [ ] Aliases must include natural-language security phrasings: `"check ssh bans"`, `"unban ip"`, `"show banned ips"`, `"ssh jail status"`

#### Acceptance Criteria

- Pack passes Zod schema validation
- All command IDs follow `fail2ban.<area>.<action>` pattern
- IP-related commands use `kind: "ipv4"` argument template
- Jail-related commands use `kind: "service"` argument template (jails are named like services)

---

### Epic: ufw Pack

#### Tasks

- [ ] Create `src/features/suggestions/packs/ufw.json`
  - [ ] Pack metadata: `packId: "ufw"`, `domains: ["security", "firewall", "linux"]`, `requires.os: ["linux"]`, `requires.commandsAny: ["ufw"]`
  - [ ] Triggers: `["ufw", "firewall", "fw"]`
  - [ ] Target: 10-20 commands covering:
    - Status (`ufw status`, `ufw status verbose`, `ufw status numbered`)
    - Allow/deny rules (`ufw allow <port>`, `ufw deny <port>`, `ufw allow from <ip>`, `ufw allow <port>/tcp`)
    - Delete rules (`ufw delete <rule-number>`, `ufw delete allow <port>`)
    - Application profiles (`ufw app list`, `ufw app info <app>`)
    - Enable/disable (`ufw enable`, `ufw disable`)
    - Reset (`ufw reset`)
    - Logging (`ufw logging on`, `ufw logging off`)
  - [ ] Risk levels: `enable`/`disable` = `write`; `reset` = `destructive`; `status`/`app list` = `read`; `allow`/`deny`/`delete` = `write`
  - [ ] Aliases: `"check firewall"`, `"open port"`, `"block ip"`, `"show firewall rules"`, `"allow ssh"`

#### Acceptance Criteria

- Pack passes Zod schema validation
- All command IDs follow `ufw.<area>.<action>` pattern
- Port-related commands use `kind: "port"` argument template
- `ufw reset` has `risk: "destructive"` with clear warning description
- `ufw disable` description warns about leaving system unprotected

---

### Epic: Docker Pack

#### Tasks

- [ ] Create `src/features/suggestions/packs/docker.json`
  - [ ] Pack metadata: `packId: "docker"`, `domains: ["containers", "linux"]`, `requires.commandsAny: ["docker"]`
  - [ ] Triggers: `["docker", "container", "image", "compose", "volume"]`
  - [ ] Target: 30-50 commands covering:
    - Container lifecycle (`run`, `start`, `stop`, `restart`, `kill`, `rm`, `pause`, `unpause`)
    - Container inspection (`ps`, `ps -a`, `logs`, `logs -f`, `inspect`, `top`, `stats`, `diff`, `port`)
    - Container interaction (`exec -it <container> bash`, `exec -it <container> sh`, `attach`, `cp`)
    - Image management (`images`, `pull`, `push`, `build`, `tag`, `rmi`, `history`, `save`, `load`)
    - Volume management (`volume ls`, `volume create`, `volume rm`, `volume inspect`, `volume prune`)
    - Network management (`network ls`, `network create`, `network rm`, `network inspect`, `network connect`)
    - Docker Compose (`compose up`, `compose down`, `compose ps`, `compose logs`, `compose build`, `compose restart`)
    - System cleanup (`system prune`, `system df`, `image prune`, `container prune`)
    - Registry (`login`, `logout`, `search`)
  - [ ] Risk levels: `rm`/`rmi`/`prune`/`kill` = `destructive`; `stop`/`restart`/`start`/`pull`/`push`/`build` = `write`; `ps`/`logs`/`inspect`/`images` = `read`; `login`/`pull`/`push` = `network`
  - [ ] Common aliases: `"show running containers"`, `"container logs"`, `"enter container"`, `"build image"`, `"clean up docker"`, `"remove all stopped containers"`

#### Acceptance Criteria

- Pack passes Zod schema validation
- All command IDs follow `docker.<area>.<action>` pattern
- Container name templates use `kind: "container"`
- `docker system prune` and `docker rm` have `risk: "destructive"`
- Docker Compose commands are included as separate entries (not just `docker-compose` aliases)

---

### Epic: Git Pack

#### Tasks

- [ ] Create `src/features/suggestions/packs/git.json`
  - [ ] Pack metadata: `packId: "git"`, `domains: ["version-control"]`, `requires.commandsAny: ["git"]`
  - [ ] Triggers: `["git", "branch", "commit", "merge", "rebase", "stash"]`
  - [ ] Target: 30-50 commands covering:
    - Repository setup (`init`, `clone`, `remote add`, `remote -v`)
    - Staging (`add`, `add .`, `add -p`, `reset HEAD <file>`, `restore --staged <file>`)
    - Committing (`commit -m`, `commit --amend`, `commit --amend --no-edit`)
    - Branching (`branch`, `branch -a`, `branch -d`, `branch -D`, `checkout`, `checkout -b`, `switch`, `switch -c`)
    - Merging (`merge`, `merge --no-ff`, `merge --abort`)
    - Rebasing (`rebase`, `rebase -i`, `rebase --abort`, `rebase --continue`)
    - History (`log`, `log --oneline`, `log --graph --oneline --all`, `reflog`, `show`, `blame`)
    - Diffing (`diff`, `diff --staged`, `diff HEAD~1`)
    - Stashing (`stash`, `stash pop`, `stash list`, `stash drop`, `stash apply`)
    - Remote operations (`push`, `pull`, `fetch`, `push --force-with-lease`, `push -u origin <branch>`)
    - Cleanup (`clean -fd`, `gc`, `prune`)
    - Tags (`tag`, `tag -a`, `tag -d`, `push --tags`)
    - Configuration (`config --list`, `config --global user.name`, `config --global user.email`)
  - [ ] Risk levels: `push --force` / `clean -fd` / `branch -D` / `reset --hard` = `destructive`; `commit`/`merge`/`rebase`/`push` = `write`; `log`/`status`/`diff`/`branch` = `read`; `push`/`pull`/`fetch`/`clone` = `network`
  - [ ] Aliases: `"undo last commit"`, `"show changes"`, `"create branch"`, `"switch branch"`, `"save work"` (stash), `"view history"`, `"discard changes"`

#### Acceptance Criteria

- Pack passes Zod schema validation
- All command IDs follow `git.<area>.<action>` pattern
- Branch name templates use `kind: "branch"`
- File path templates use `kind: "path"`
- `git push --force` and `git reset --hard` have `risk: "destructive"` with clear warnings
- `git push`/`pull`/`fetch` have `risk: "network"` (remote operations)
- Force-push variants (`--force`, `--force-with-lease`) are separate entries with different risk levels

---

### Epic: Pack Validation Script

#### Tasks

- [ ] Add a pack validation test in `src/features/suggestions/__tests__/schema.test.ts` (or extend it) that:
  - [ ] Loads all JSON files from the packs directory
  - [ ] Validates each against the Zod schema
  - [ ] Checks for duplicate `packId` values
  - [ ] Checks for duplicate command `id` values across all packs
  - [ ] Checks that all `risk` fields are explicit (no defaults)
  - [ ] Checks that all commands have at least 2 tokens
  - [ ] Reports clear error messages per pack/command for failures

#### Acceptance Criteria

- `pnpm test` validates all bundled packs
- Adding a malformed pack causes a clear, specific test failure
- Duplicate IDs across packs are caught

#### Testing Requirements

- All 7 packs pass the validation test
- At least one negative test case (intentionally invalid pack)
