# Releases

GitHub Actions publishes the `@vitorsreis/vueforge` package to the public npm registry and creates a GitHub Release with the same tarball when a stable SemVer tag such as `v0.1.0` is pushed. A tag push only requests a release. The privileged workflow runs from the default branch, then verifies the tag and candidate commit before it builds or publishes anything.

1. Set the version in `package.json` and the lockfile with `npm version <version> --no-git-tag-version`.
2. Update `CHANGELOG.md` and merge the release changes into `main`.
3. Create and push the signed tag from the release commit. Tags must be annotated OpenPGP tags signed by the maintainer key configured in the repository variable `RELEASE_GPG_FINGERPRINT`.

```sh
git tag -s v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

The workflow derives the candidate version from the tagged commit, rejects lightweight and unsigned tags, imports only the public key in `RELEASE_GPG_PUBLIC_KEY`, and requires the tag's commit to equal the tagged workflow event and be reachable from `origin/main`. It runs quality checks, an audit, and package qualification before creating one tarball used by both publication paths. The publish job has `contents: write` and `id-token: write` only, runs in the protected `release` environment, publishes with npm trusted publishing and OIDC, and creates or reconciles the GitHub Release. It does not check out or install project code.

## Required repository configuration

- Configure the `release` GitHub environment so deployments require the intended maintainer approval. Restrict its branches or tags to `main` and review the environment reviewers whenever maintainers change.
- Add repository variables `RELEASE_GPG_PUBLIC_KEY` and `RELEASE_GPG_FINGERPRINT`. The fingerprint must be the full primary-key fingerprint. Store no private key or npm token in GitHub Secrets.
- Protect `main`, require the normal CI checks and review, and restrict who can modify `.github/workflows/` and release-related repository variables. Add a tag ruleset that requires the release tag pattern to be created only by the release maintainers and prevents tag updates or deletion during a release.
- In npm package settings, add a GitHub Actions trusted publisher for repository `vitorsreis/vueforge`, workflow `release.yml`, and environment `release`. Allow direct publishing. npm requires CLI 11.5.1 or newer and Node 22.14 or newer. The first successful publish must happen within two days of creating this configuration, or npm expires it and requires a new configuration.
- The package must be public before the first publish. The publish job uses `--access public --provenance` and `--ignore-scripts`; npm trusted publishing supplies provenance through OIDC.

The release is intentionally fail-closed when a tag is moved, deleted, unsigned, signed by another key, or points outside `main`. If npm has already accepted the version, a retry compares the registry's SHA-512 integrity to the generated tarball and skips a second publish. If the GitHub Release already has the same asset, the workflow compares bytes and reuses it. An interrupted run can therefore be retried after the underlying tag and environment checks pass.

GitHub's `workflow_run` event gives the privileged workflow the default-branch workflow file and a tag workflow's head SHA, but does not provide trusted tag metadata. The verification script resolves the tag from the repository and checks its signed object, target SHA, signer, and main ancestry. This still depends on repository rulesets and the protected environment to prevent an unauthorized maintainer from changing the verifier or approved key.
