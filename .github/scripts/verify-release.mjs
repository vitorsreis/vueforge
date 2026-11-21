import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { env, stdout } from 'node:process'

const tag = env.RELEASE_TAG
const publicKey = env.RELEASE_GPG_PUBLIC_KEY
const fingerprint = env.RELEASE_GPG_FINGERPRINT?.trim().toUpperCase()
assert.match(
  tag ?? '',
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
  'Expected a stable SemVer tag',
)
assert.ok(publicKey, 'Set RELEASE_GPG_PUBLIC_KEY to the maintainer public key')
assert.match(
  fingerprint ?? '',
  /^(?:[A-F0-9]{40}|[A-F0-9]{64})$/,
  'Set RELEASE_GPG_FINGERPRINT to the maintainer primary fingerprint',
)
assert.ok(env.GNUPGHOME, 'Use a dedicated verification keyring')

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' })
const tagRef = git('rev-parse', '--verify', `refs/tags/${tag}`)
assert.equal(tagRef.status, 0, 'The release tag does not exist')
const tagObject = tagRef.stdout.trim()
const annotatedTag = git('cat-file', 'tag', tagObject)
assert.equal(annotatedTag.status, 0, 'Expected an annotated release tag')
const [, type, name] = annotatedTag.stdout.split('\n')
assert.equal(
  type,
  'type commit',
  'Release tags must directly reference a commit',
)
assert.equal(
  name,
  `tag ${tag}`,
  'The release ref must match the signed tag name',
)

const importKey = spawnSync('gpg', ['--batch', '--no-tty', '--import'], {
  input: publicKey,
})
assert.equal(importKey.status, 0, 'Could not import RELEASE_GPG_PUBLIC_KEY')
const verification = git(
  '-c',
  'gpg.format=openpgp',
  '-c',
  'gpg.minTrustLevel=undefined',
  'verify-tag',
  '--raw',
  tagObject,
)
assert.equal(
  verification.status,
  0,
  'Release tag must have a valid OpenPGP signature',
)
const validSignature = verification.stderr
  .split(/\r?\n/)
  .find((line) => line.startsWith('[GNUPG:] VALIDSIG '))
assert.ok(validSignature, 'Release tag must have a valid OpenPGP signature')
const fields = validSignature.split(' ')
assert.equal(
  fields[11] ?? fields[2],
  fingerprint,
  'Release tag must be signed by the approved maintainer key',
)

const target = git('rev-parse', '--verify', `${tagObject}^{commit}`)
assert.equal(target.status, 0, 'Could not resolve the release commit')
const commit = target.stdout.trim()
assert.equal(
  commit,
  env.RELEASE_CANDIDATE,
  'The tag must point to the release candidate',
)
assert.equal(
  git('merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main').status,
  0,
  'The release commit must be reachable from origin/main',
)
stdout.write(`commit=${commit}\ntag_object=${tagObject}\n`)
