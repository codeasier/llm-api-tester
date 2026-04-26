# Contributing

## Before you open a pull request

1. Create or identify the related issue first.
2. Use the issue templates under `.github/ISSUE_TEMPLATE/` when opening new issues.
3. Keep each pull request scoped to at least one tracked issue.

## Pull request requirements

Every pull request must reference at least one issue in the PR description.

Use one of these forms in the `Related issue(s)` section of the PR template:

- `Closes #123`
- `Fixes #123`
- `Resolves #123`
- `Refs #123`

Use `Closes` / `Fixes` / `Resolves` when the pull request should automatically close the issue after merge.
Use `Refs` when the pull request is only part of the issue and the issue should remain open.

## Validation

Before requesting review, run:

```bash
pnpm run verify
```

This repository also runs CI checks for frontend and Rust validation.

## Merge protection

The repository includes a GitHub Actions check that fails when the PR description does not reference an issue.
To fully enforce the rule, maintainers should mark the `PR linked issue` check as required in the branch protection settings for `main`.
