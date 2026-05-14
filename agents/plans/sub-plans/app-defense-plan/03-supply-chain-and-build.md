# Supply Chain & Build Security

## Goal

Harden the entire build and distribution pipeline to prevent malicious code from being injected during the build process, and ensure users only receive authentic, untampered binaries.

## Architectural Analysis

The pipeline is the ultimate single point of failure. If GitHub Actions or dependencies are compromised, all local app defenses are moot. By locking down dependencies, ensuring reproducible builds, preventing DLL hijacking via ASAR configuration, and cryptographically signing all releases, we establish a verifiable chain of trust.

## Dependencies

- Existing GitHub Actions CI/CD workflows.
- Developer accounts for Apple and Microsoft (for code signing).

## Risks

- Breaking the build pipeline while migrating to strict pnpm or pinned actions.
- Code signing configuration can be notoriously difficult and cause delayed releases.

## Epics

### Epic: Dependency Hardening & Scanning

#### Tasks

- [ ] Lock all dependency versions (D2.1)
  - [ ] Remove all `^` and `~` ranges in `package.json` and set `save-exact=true` in `.npmrc`.
- [ ] Enforce strict pnpm settings (D2.2)
  - [ ] Set `strict-peer-dependencies=true`, `auto-install-peers=false`, and `shamefully-hoist=false`.
- [ ] Integrate Dependency Monitoring (D2.6, D5.4)
  - [ ] Integrate Socket.dev and `better-npm-audit` into the CI pipeline.
- [ ] Implement SBOM Generation (D9.6)
  - [ ] Add CycloneDX to generate an `sbom.json` as part of the release build.

#### Acceptance Criteria
- `pnpm install` works perfectly with exact versions and strict hoisting.
- CI pipeline blocks pull requests that introduce vulnerable dependencies.

#### Rollback Plan
- Relax `strict-peer-dependencies` if third-party libraries completely break the build.

#### Testing Requirements
- CI execution of audit commands.

### Epic: Pipeline and Release Integrity

#### Tasks

- [ ] Pin GitHub Actions to SHA (D9.1)
  - [ ] Audit `.github/workflows/*` and replace tags (e.g., `@v4`) with exact commit SHAs.
- [ ] Implement Full Code Signing (D9.4)
  - [ ] Configure macOS Apple Developer ID signing/notarization and Windows EV code signing.
- [ ] Reproducible Builds & Checksums (D9.3)
  - [ ] Ensure builds generate `checksums.txt` containing SHA256 hashes of the `.exe`, `.dmg`, and `.AppImage` files.
- [ ] Prevent DLL/dylib Hijacking (D7.4)
  - [ ] Configure `asar: true` in `electron-builder.yml` and restrict `asarUnpack`.
  - [ ] Implement OS-specific mitigations (e.g., `com.apple.security.cs.disable-library-validation = false` on macOS).
- [ ] Auto-Update Signature Verification (D7.3)
  - [ ] Configure `electron-updater` to strictly verify the signature of downloaded updates.

#### Acceptance Criteria
- Mac and Windows binaries can be installed without warnings.
- Auto-updater rejects tampered binaries.
- Release artifacts always include a checksum file.

#### Rollback Plan
- Temporarily disable auto-update signature enforcement if certificates expire or cause false positives.

#### Testing Requirements
- Manual test of auto-updater with an intentionally unsigned/tampered binary.
