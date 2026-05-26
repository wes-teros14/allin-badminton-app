# Feature Research: v1.4 Finance Manual Shuttle Allocation

## Allocation Mode

Table stakes:
- preserve the current automatic finance allocation path exactly as-is when the toggle is on
- expose a clear auto/manual switch in the shuttle usage section

Differentiators:
- make the mode choice understandable by showing whether the app is applying the existing automatic rules or waiting for explicit batch picks

Anti-feature:
- changing the default or silently altering the existing allocation rules in auto mode

## Manual Batch Selection

Table stakes:
- searchable by brand
- selectable across multiple batches
- allow exact shuttle counts per selected batch
- derive total shuttle usage from selected rows rather than a separate total input

Differentiators:
- use inventory-style details so batches can be distinguished quickly
- support editing existing saved allocations without forcing full re-entry

Anti-feature:
- a plain select that hides batch identity details or forces users to guess between similar brands

## Batch Detail Visibility

Table stakes:
- show stable batch identity such as tube ID / range
- show brand
- show remaining shuttles
- show cost context consistent with inventory
- show notes when present if that helps distinguish batches

Differentiators:
- keep list rows compact but information-dense enough for quick QM decisions

Inference:
- the best candidate fields are the same ones already visible in inventory: tube ID, brand, shuttles left, cost per tube, and notes

## Validation And Editing

Table stakes:
- at least one batch required in manual mode before save
- no row can exceed that batch's remaining stock
- no zero or negative shuttle counts
- total auto-recomputes as rows change

Differentiators:
- surface row-level validation inline instead of only failing on submit
- disable already-selected batches in the picker to reduce duplicate-row errors

Anti-feature:
- introducing a new finance completion gate tied to a separate "required shuttle count"
