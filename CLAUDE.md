# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is a fresh scaffold for AWS ECS infrastructure managed with Terraform. `main.tf` currently exists but is empty — there is no established module structure, provider configuration, or resource layout yet. When adding the first resources, use standard Terraform conventions (e.g. separate `variables.tf`, `outputs.tf`, `versions.tf` files) rather than growing a single `main.tf` indefinitely.

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

## Notes

- `*.tfvars`, `*.tfstate`, and `.terraform/` are gitignored — never commit these, they contain environment-specific data or secrets.
- `override.tf` / `*_override.tf` files are gitignored by convention for local-only resource overrides.
