import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env, execPath, platform } from 'node:process'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

const verifyScript = fileURLToPath(
  new URL('./verify-release.mjs', import.meta.url),
)

test('verifies the tag object, authorized signer, and origin/main ancestry', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'vueforge-release-'))
  const signerHome = join(repo, 'sign')
  const verifierHome = join(repo, 'verify')
  const gitConfig = join(repo, 'gitconfig')
  mkdirSync(signerHome, { mode: 0o700 })
  mkdirSync(verifierHome, { mode: 0o700 })
  writeFileSync(gitConfig, '')
  t.after(() => {
    for (const home of [signerHome, verifierHome]) {
      spawnSync('gpgconf', ['--homedir', home, '--kill', 'gpg-agent'])
    }
    rmSync(repo, { recursive: true, force: true, maxRetries: 5 })
  })

  const gitEnv = {
    ...env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: gitConfig,
  }
  const signerEnv = { ...gitEnv, GNUPGHOME: signerHome }
  const run = (command, args) =>
    spawnSync(command, args, { cwd: repo, env: signerEnv, encoding: 'utf8' })
  const checked = (command, args) => {
    const result = run(command, args)
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  const git = (...args) => checked('git', args)
  const gpg = (...args) =>
    checked('gpg', ['--batch', '--pinentry-mode', 'loopback', ...args])
  const fingerprint = (identity) => {
    const key = gpg('--with-colons', '--list-keys', identity)
    return key
      .split(/\r?\n/)
      .find((line) => line.startsWith('fpr:'))
      .split(':')[9]
  }

  const maintainer = 'Release Test <release@example.invalid>'
  const other = 'Other Test <other@example.invalid>'
  gpg(
    '--passphrase',
    '',
    '--quick-generate-key',
    maintainer,
    'ed25519',
    'cert',
    '0',
  )
  gpg('--passphrase', '', '--quick-generate-key', other, 'ed25519', 'sign', '0')
  const approved = fingerprint(maintainer)
  gpg('--passphrase', '', '--quick-add-key', approved, 'ed25519', 'sign', '0')
  const publicKeys = gpg('--armor', '--export', approved, fingerprint(other))

  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.name', 'Release Test')
  git('config', 'user.email', 'release@example.invalid')
  if (platform === 'win32') {
    const gpgPath = checked('where.exe', ['gpg'])
      .split(/\r?\n/)[0]
      .replaceAll('\\', '/')
    git('config', 'gpg.program', gpgPath)
  }
  git('commit', '--quiet', '--allow-empty', '-m', 'Release commit')
  const releaseCommit = git('rev-parse', 'HEAD')
  git('tag', '-u', approved, '-m', 'Signed release', 'v1.0.0')
  const tagObject = git('rev-parse', 'refs/tags/v1.0.0')
  git('tag', 'v1.0.1')
  git('tag', '-a', '-m', 'Unsigned release', 'v1.0.2')
  git('tag', '-u', fingerprint(other), '-m', 'Other signer', 'v1.0.3')
  git('update-ref', 'refs/tags/v1.0.4', tagObject)
  git('commit', '--quiet', '--allow-empty', '-m', 'Advanced remote main')
  git(
    'fetch',
    '--quiet',
    '--no-tags',
    '.',
    'refs/heads/main:refs/remotes/origin/main',
  )
  git('commit', '--quiet', '--allow-empty', '-m', 'Local-only commit')
  const localCommit = git('rev-parse', 'HEAD')
  git('tag', '-u', approved, '-m', 'Outside origin/main', 'v1.0.5')

  const verify = (tag, candidate = releaseCommit, key = publicKeys) => {
    const result = spawnSync(execPath, [verifyScript], {
      cwd: repo,
      env: {
        ...gitEnv,
        GNUPGHOME: verifierHome,
        RELEASE_TAG: tag,
        RELEASE_CANDIDATE: candidate,
        RELEASE_GPG_PUBLIC_KEY: key,
        RELEASE_GPG_FINGERPRINT: approved,
      },
      encoding: 'utf8',
    })
    assert.ifError(result.error)
    return result
  }
  const allowed = verify('v1.0.0')
  assert.equal(allowed.status, 0, allowed.stderr)
  assert.equal(
    allowed.stdout.trim(),
    `commit=${releaseCommit}\ntag_object=${tagObject}`,
  )

  for (const [tag, error] of [
    ['v1.0.1', /annotated release tag/],
    ['v1.0.2', /valid OpenPGP signature/],
    ['v1.0.3', /approved maintainer key/],
    ['v1.0.4', /match the signed tag name/],
    ['v1.0.5', /reachable from origin\/main/],
    ['v1.0.6', /release tag does not exist/],
    ['v1.0.0-rc.1', /stable SemVer/],
  ]) {
    const rejected = verify(tag, tag === 'v1.0.5' ? localCommit : releaseCommit)
    assert.notEqual(rejected.status, 0, tag)
    assert.match(rejected.stderr, error, tag)
    assert.equal(rejected.stdout, '', tag)
  }
  assert.match(
    verify('v1.0.0', localCommit).stderr,
    /point to the release candidate/,
  )
  assert.match(
    verify('v1.0.0', releaseCommit, '').stderr,
    /RELEASE_GPG_PUBLIC_KEY/,
  )
})
