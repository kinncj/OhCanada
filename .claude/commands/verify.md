---
description: Run every quality gate and report what failed
---
Run all TrueNorth gates and report results as a table (gate, pass/fail, key numbers):

```
make lint typecheck test test-e2e test-perf test-a11y validate-content verify-content verify-art
```

Do not fix anything yourself. For each failure, name the owning agent from `.claude/agents/` and quote the
smallest piece of output that identifies the cause. Summarise budgets (payload, texture memory, frame time,
coverage) against the limits in `CLAUDE.md`.
