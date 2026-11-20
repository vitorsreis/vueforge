# Releases

GitHub Actions publishes a GitHub Release with the package tarball when a stable SemVer tag such as `v0.1.0` is pushed. The package stays private to npm while the public API is being designed.

1. Set the version in `package.json` and the lockfile with `npm version <version> --no-git-tag-version`.
2. Update `CHANGELOG.md` and merge the release changes into `main`.
3. Create and push the signed tag from the release commit.

```sh
git tag -s v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

The workflow checks the tag against the package version, runs quality checks and an audit, and packs the tested build. A separate job publishes the artifact using GitHub's workflow token. Publication requires a GitHub repository where Actions may create releases.
