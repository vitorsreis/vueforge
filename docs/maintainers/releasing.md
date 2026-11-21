# Release process

Vueforge publishes `@vitorsreis/vueforge` and creates a matching GitHub Release from a signed stable SemVer tag.

## Repository setup

Configure these resources before the first release:

- A protected GitHub environment named `release` with the intended reviewers.
- Repository variables `RELEASE_GPG_PUBLIC_KEY` and `RELEASE_GPG_FINGERPRINT`.
- Branch protection for `main` and tag protection for release tags.
- An npm trusted publisher for repository `vitorsreis/vueforge`, workflow `release.yml`, and environment `release`.

The npm package must be public. The workflow uses npm trusted publishing with OIDC and provenance, so it does not use an npm token stored in GitHub Secrets.

## Publish

1. Update `package.json` and `package-lock.json` to the release version.
2. Update the user-facing release notes for that version.
3. Merge the release commit into `main`.
4. Create and push an annotated, signed tag with the same version.

```sh
npm version 1.0.0 --no-git-tag-version
git add package.json package-lock.json
git commit -S -m "release: v1.0.0"
git tag -s v1.0.0 -m "Release v1.0.0"
git push origin main v1.0.0
```

The release workflow runs the quality checks, dependency audit, package qualification, tag verification, npm publication, and GitHub Release upload.

## Verify

```sh
npm view @vitorsreis/vueforge@1.0.0 version dist.integrity
```

Check that the npm version and GitHub Release use the same tag. Investigate a failed release before creating another tag for the same version.
