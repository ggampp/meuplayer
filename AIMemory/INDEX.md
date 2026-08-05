# AIMemory — Index

This directory is the shared memory for coding agents working on this project
(the **Colmeia Handoff** protocol). Read these files at the start of every
session, in order:

1. `PROJECT_OVERVIEW.md` — what this project is and its hard rules.
2. The tail of `work.log` — the most recent events.
3. The newest files in `handoffs/` — where the last agent stopped.

## Contents

- `PROJECT_OVERVIEW.md` — durable project facts, conventions, gotchas.
- `work.log` — append-only event stream (never edit past entries).
- `handoffs/` — structured handoffs between agents/sessions.
- `knowledge/` — promoted durable decisions and lessons.
- `archive/` — rotated/cold logs and superseded handoffs.

See `docs/PROTOCOL.md` in the colmeia-handoff repo for the full contract.
