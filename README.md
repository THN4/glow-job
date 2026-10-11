# glow-job
NTT DATA Digital Innovation Challenge 2026

## `data-pipeline` submodule

`data-pipeline/` is a Git submodule that points to a specific commit in the
[`glow-job-data-pipeline`](https://github.com/THN4/glow-job-data-pipeline)
repository. The commit recorded by `glow-job` is the version the team should
use; the submodule does not automatically follow the latest changes upstream.

### Clone or initialize the submodule

When cloning `glow-job`, initialize its submodules:

```bash
git clone --recurse-submodules <glow-job-repository-url>
```

If you already cloned `glow-job` and `data-pipeline/` is empty or not initialized,
run this from the `glow-job` repository root:

```bash
git submodule update --init --recursive data-pipeline
```

This checks out the exact `data-pipeline` commit selected by the current
`glow-job` commit. It does not update to the latest upstream commit.

If your checkout has an older `data-engineer/` folder instead, run the command
from the repository root as shown above. Git will create `data-pipeline/` next
to `data-engineer/`; it will not rename or delete the older folder. Keep any
work in `data-engineer/` until you have confirmed it is no longer needed.

If a `data-pipeline/` folder already exists and Git cannot initialize the
submodule because the path is not empty, do not delete or overwrite it. Check
for local work first and ask the project maintainer how to handle that checkout.

### Development rules

- Continue regular feature development in the `glow-job` repository.
- Do not edit files, create commits, switch branches, or run `git pull` from
  inside `data-pipeline/` as part of `glow-job` work.
- Do not run `git submodule update --remote` or manually change the submodule
  commit. That moves the version pinned by `glow-job` and can make everyone's
  checkout inconsistent.
- If work requires a change to `data-pipeline`, make that change through its
  own repository workflow and ask the project maintainer to update the pinned
  submodule commit in `glow-job`.
- Pulling the `glow-job` repository itself follows the normal team workflow;
  after switching or pulling its branch, run the initialization command above
  if Git reports that the submodule is not initialized.
