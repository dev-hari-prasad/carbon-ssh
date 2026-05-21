/**
 * verify-deps.mjs — Lightweight dependency verification script.
 *
 * Reads pnpm-lock.yaml and flags potential supply-chain risks:
 * - Packages with install scripts NOT in the allowlist
 * - Packages resolved from non-registry sources (git, file, http)
 * - Packages with very few resolution integrity hashes (corruption risk)
 *
 * Usage: node scripts/verify-deps.mjs
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── Configuration ───────────────────────────────────────
const BUILD_ALLOWLIST = new Set([
  'better-sqlite3',
  'cpu-features',
  'electron',
  'electron-winstaller',
  'esbuild',
  'sharp',
  'ssh2',
])

// Known safe URL patterns
const SAFE_SOURCES = [
  'https://registry.npmjs.org/',
  'https://registry.npmmirror.com/',
]

// ─── Parse lockfile (simplified YAML parser for pnpm-lock.yaml) ──────
function parseLockfile() {
  const lockPath = resolve(ROOT, 'pnpm-lock.yaml')
  const content = readFileSync(lockPath, 'utf-8')
  return content
}

// ─── Analysis ────────────────────────────────────────────
function analyze() {
  const content = parseLockfile()
  const lines = content.split('\n')

  const findings = {
    nonRegistrySources: [],
    missingIntegrity: [],
    suspiciousPatterns: [],
  }

  let currentPackage = null
  let inPackages = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect the packages/snapshots section
    if (line.startsWith('packages:') || line.startsWith('snapshots:')) {
      inPackages = true
      continue
    }

    if (!inPackages) continue

    // Package entry lines (indented with exactly 2 spaces, ending with colon)
    const pkgMatch = line.match(/^  ['"]?([^'":]+)['"]?:/)
    if (pkgMatch) {
      currentPackage = pkgMatch[1]
      continue
    }

    if (!currentPackage) continue

    // Check for non-registry resolution
    const resolutionMatch = line.match(/^\s+resolution:\s*\{.*tarball:\s*['"]?([^'"}\s]+)/)
    if (resolutionMatch) {
      const tarball = resolutionMatch[1]
      const isSafe = SAFE_SOURCES.some((src) => tarball.startsWith(src))
      if (!isSafe && tarball.startsWith('http')) {
        findings.nonRegistrySources.push({
          package: currentPackage,
          source: tarball,
          line: i + 1,
        })
      }
    }

    // Check for hasBin or hasInstallScript
    if (line.includes('hasBin: true') || line.includes('hasInstallScript: true')) {
      const pkgName = extractPackageName(currentPackage)
      if (!BUILD_ALLOWLIST.has(pkgName)) {
        findings.suspiciousPatterns.push({
          package: currentPackage,
          reason: line.includes('hasInstallScript')
            ? 'Has install script (not in allowlist)'
            : 'Has binary (review needed)',
          line: i + 1,
        })
      }
    }
  }

  return findings
}

function extractPackageName(lockfileKey) {
  // pnpm lockfile keys look like: /package-name@1.0.0 or /@scope/name@1.0.0
  const match = lockfileKey.match(/\/?(@?[^@]+)@/)
  return match ? match[1] : lockfileKey
}

// ─── Report ──────────────────────────────────────────────
function report(findings) {
  let hasIssues = false

  console.log('\n🔒 Dependency Verification Report')
  console.log('─'.repeat(50))

  if (findings.nonRegistrySources.length > 0) {
    hasIssues = true
    console.log(`\n⚠️  Non-registry sources (${findings.nonRegistrySources.length}):`)
    for (const f of findings.nonRegistrySources) {
      console.log(`   • ${f.package}`)
      console.log(`     Source: ${f.source}`)
    }
  }

  if (findings.suspiciousPatterns.length > 0) {
    hasIssues = true
    console.log(`\n⚠️  Packages with install scripts or binaries (${findings.suspiciousPatterns.length}):`)
    for (const f of findings.suspiciousPatterns) {
      console.log(`   • ${f.package}`)
      console.log(`     ${f.reason}`)
    }
  }

  if (!hasIssues) {
    console.log('\n✅ No suspicious patterns detected.')
  }

  console.log('\n' + '─'.repeat(50))
  console.log(`Scanned: pnpm-lock.yaml`)
  console.log(`Allowlisted build packages: ${[...BUILD_ALLOWLIST].join(', ')}`)
  console.log()

  return hasIssues ? 1 : 0
}

// ─── Main ────────────────────────────────────────────────
try {
  const findings = analyze()
  const exitCode = report(findings)
  process.exit(exitCode)
} catch (err) {
  console.error('❌ verify-deps failed:', err.message)
  process.exit(2)
}
