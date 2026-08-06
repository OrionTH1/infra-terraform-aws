# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is a fresh scaffold for AWS ECS infrastructure managed with Terraform. `main.tf` currently exists but is empty — there is no established module structure, provider configuration, or resource layout yet. When adding the first resources, use standard Terraform conventions (e.g. separate `variables.tf`, `outputs.tf`, `versions.tf` files) rather than growing a single `main.tf` indefinitely.

## What the workload is meant to represent

`backend/` is a placeholder image whose only job is to give ECS something to run. **Never size or calibrate anything against it.**

The infra — and the simulator that explains it — targets a medium-to-large company's production service. When choosing capacity, thresholds, or simulation constants, assume the task is running a real backend: authentication on every request, routes with substantial business logic, and several database queries per request.

This matters because the placeholder distorts every number. A single task and 0.5 ACU would serve it comfortably, which would make the autoscaling ceilings, the WAF limits, and the Aurora capacity range all look absurdly oversized — and would defeat the point of the project.

Constants that describe the *workload* (per-request app time, queries per request) are declared assumptions about that imagined backend, not measurements of `backend/`. Record them as assumptions in `simulator/CALIBRATION.md` rather than presenting them as sourced. Constants that describe *AWS behavior* still have to come from AWS documentation or published benchmarks.

## Commands

```bash
terraform init                        # initialize providers/backend
terraform fmt -recursive              # format all .tf files
terraform validate                    # validate configuration syntax
terraform plan                        # preview changes
terraform apply                       # apply changes
terraform plan -out=tfplan            # save a plan for review before apply
terraform apply tfplan
```

There is no CI, test suite, or linter configured in this repo yet.

## Code style

Do not write comments. Code must explain itself through naming and structure — if a piece of logic needs a comment to be understood, restructure it or extract a named function or constant instead. This applies to every language in the repo (`.tf`, `.ts`, `.tsx`), including JSDoc/docblocks and JSX comments.

The exception is machine-read directives, which are not comments even though they use comment syntax. Never remove these:

- `# checkov:skip=CKV_...` in `.tf` files — the CI security scan reads them, and dropping one turns into a pipeline failure.
- Linter/compiler pragmas such as `// eslint-disable-*`, `// oxlint-disable-*`, `// @ts-expect-error`.

Explanations that would have been comments belong in `ARCHITECTURE.md` or the relevant doc, where they are versioned prose rather than drift-prone annotations.

## Notes

- `*.tfvars`, `*.tfstate`, and `.terraform/` are gitignored — never commit these, they contain environment-specific data or secrets.
- `override.tf` / `*_override.tf` files are gitignored by convention for local-only resource overrides.
