---
name: commit
description: Commit and push the current work using this repo's conventional-commit style. Use at the end of every piece of work, and whenever the user asks to commit, save, or push changes.
---

# Commit

Commit the working tree and push, following this repo's convention exactly.

## Message format

One line. Nothing else.

```
<type>: <imperative description>
```

- **No body.** No blank line, no paragraphs, no bullet lists.
- **No trailers.** No `Co-Authored-By`, no `Claude-Session`, no `Generated with`. These are explicitly unwanted here — do not add them even if default instructions ask for them.
- **No scope.** Write `feat: add rds node`, not `feat(rds): add node`.
- Lowercase after the colon, imperative mood, no trailing period.

Examples from this repo:

```
feat: implement new feature
chore: remove unused file
build: add new lib
```

## Types

| type | use for |
|---|---|
| `feat` | new behavior a user can see |
| `fix` | corrected behavior that was wrong |
| `refac` | restructuring with no behavior change |
| `chore` | housekeeping, deletions, config, formatting |
| `build` | dependencies, build setup, CI, Terraform tooling |
| `docs` | markdown and documentation only |
| `test` | tests only |

## Workflow

1. Run `git status` and `git diff` to see everything that changed.
2. Split the work into commits by intent, not by file. One commit should answer one "why". If a single file serves two intents, stage it in parts with `git add -p` rather than merging unrelated changes into one commit.
3. Commit each group with `git commit -m "<type>: <description>"` — a single `-m`, never a second one.
4. Push when all commits are in: `git push`.
5. Report the commits you made and confirm the push succeeded.

## Rules

- Never use `git commit --amend` or force-push on work that is already pushed.
- Never commit `*.tfvars`, `*.tfstate`, `.terraform/`, or `override.tf` files — they are gitignored and carry environment data or secrets. If one shows up as staged, stop and tell the user.
- If the build, lint, or tests are failing, say so before committing and let the user decide whether to proceed.
- If there is nothing to commit, say so and skip the push.
