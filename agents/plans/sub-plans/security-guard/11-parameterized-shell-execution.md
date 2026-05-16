# Parameterized Shell Execution & Command Safety

## Goal

Ensure remote SSH execution for the Security Guard engine strictly avoids string concatenation in Bash. Use parameterized inputs (such as passing arguments via `stdin` or using robust escaping wrappers) when modifying config files or disabling services, completely eliminating remote command injection vulnerabilities.

## Architectural Analysis

In a standard automated SSH hardening pipeline, generating scripts dynamically (e.g., `echo "${config_value}" > /etc/config`) creates massive command injection risk. If an environment variable or piece of retrieved server state contains `'`, `"`, or `$()`, the string concatenation breaks the shell and can lead to arbitrary code execution or server corruption.

To build a safe Execution Engine:
1. We must treat the remote SSH shell as a strict execution environment where the *command scaffolding* is completely static.
2. Dynamic data (like file contents, new port numbers, or dynamic rules) must be streamed over `stdin` to the remote process.
3. Remediation actions must use an execution factory that enforces this separation of "Command" and "Payload".

## Dependencies

- **Scanner Modules**: Must be refactored so they don't produce concatenated command strings.
- **Remediation Engine**: Must be upgraded to utilize the new execution factory.
- **SSH Client (`ws-handler.cjs` / execute util)**: Must support piping data to `stdin` of the remote process cleanly.

## Risks

- **Shell Variations**: The target machine may use `zsh`, `bash`, or standard `sh`. The execution wrappers must be universally compatible POSIX sh.
- **End of File (EOF) Handling**: Writing dynamic content via `stdin` requires precise closing of the stream in Node.js, otherwise the remote process will hang indefinitely expecting more input.
- **Complex Awk/Sed**: Heavy text manipulation using injected variables in `sed` or `awk` is prone to escaping errors. Replacing file parts via `sudo tee` is safer but requires careful temporary file management.

## Epics

### Epic: Secure Command Execution Factory

#### Tasks

- [ ] Task: Design the `RemoteExecutor` Interface
  - [ ] Sub-task: Create a `.exec(command: string[], options: { stdin?: string | Buffer, sudo?: boolean })` method signature. Notice `command` is an Array of strings to cleanly model args conceptually, even if we must join them with safe escapes for SSH.
- [ ] Task: Implement Robust Bash Escaping
  - [ ] Sub-task: Build a utility that wraps every argument in single quotes `''`, safely handling inner single quotes by translating them to `'"'"'`. (e.g., `[ 'echo', 'hello world' ]` -> `'echo' 'hello world'`).
- [ ] Task: Support `stdin` Streaming
  - [ ] Sub-task: Update the SSH abstraction to call `stream.write(stdin)` and `stream.end()` immediately after spawning the command if `stdin` is provided.

#### Acceptance Criteria

- The Executor successfully escapes malicious strings (e.g., `$(rm -rf /)`) treating them purely as literals.
- `stdin` streaming works seamlessly without hanging the shell.

#### Rollback Plan

- Standardize around the old simplistic execution mode only for read-only scanner operations as a fallback until the safe executor is vetted.

#### Testing Requirements

- **Security tests**: Create an automated test that attempts to execute a command containing standard injection payloads (`;`, `&&`, `$()`, `` ` ``). Assert that none of the payloads execute.
- **Integration tests**: Verify that large payloads (e.g., a 20KB `sshd_config` file) stream completely and accurately over `stdin` without truncation.

---

### Epic: Parameterized Config File Management

#### Tasks

- [ ] Task: Refactor Config Writers
  - [ ] Sub-task: Instead of running `sed -i "s/Port $OLD_PORT/Port $NEW_PORT/"`, alter the config file completely in-memory on the client (the Node.js process).
  - [ ] Sub-task: Send the completely rebuilt config file back to the server using the parameterized executor: `cat > /tmp/sshd_config.tmp` followed by structural validation, then moving it to `/etc/ssh/sshd_config`.
- [ ] Task: Refactor Remediation Scripts
  - [ ] Sub-task: Find all instances in the current Security Guard plan that mention `sed` or `echo` with dynamic values.
  - [ ] Sub-task: Convert them to the "Fetch -> Modify Locally -> Stream Back -> Swap" pattern.
- [ ] Task: Enhance Rollback Engine
  - [ ] Sub-task: Ensure the `snapshot` system uses `cat` to output the file to the Node.js client, storing the backup safely inside the local `~/.carbon` directory rather than relying purely on remote `/var/lib/carbon/backups/`.

#### Acceptance Criteria

- No remediation script contains string concatenation that merges server state with executable command structure.
- Modifying complex files like `sshd_config` operates transactionally using temporary files and a final atomic `mv`.

#### Rollback Plan

- If the "Modify Locally" approach introduces parsing bugs for exotic `sshd_config` setups, revert to a strictly controlled `sed` injection that has heavy pre-regex validation (e.g., verifying `NEW_PORT` is strictly an integer before embedding).

#### Testing Requirements

- **Unit tests**: Test the local config altering logic against various non-standard SSH config layouts.
- **System tests**: Run a full modification cycle on a virtual machine, proving the atomic replacement of the file does not leave the file empty if the network drops mid-stream.
