# Pitfalls Research: v1.4 Finance Manual Shuttle Allocation

## UI And Accessibility

- Building a custom searchable dropdown without proper combobox semantics risks broken keyboard access and poor screen-reader behavior
- A multi-select picker that does not clearly separate search text from selected values becomes hard to edit on mobile

## Data Integrity

- Letting the same batch be selected twice can create accidental over-allocation or confusing duplicate rows
- Computing available stock from stale data can cause save failures or silent overuse if another session has logged usage in the meantime
- Replacing all session `shuttle_usage` rows on every save is simple, but edit mode must prefill saved rows correctly or the QM can overwrite data by accident

## Product Drift

- Mixing manual and auto behaviors in one save path can accidentally change the current automatic rule set
- Showing different batch details in finance than inventory creates trust problems when the QM cross-checks stock
- Requiring a separate total input in manual mode conflicts with the product decision that totals should be derived from row entries

## Verification Risks

- Unit tests that only cover `allocateCheapestFirst` will miss manual-mode validation and edit behavior
- Browser coverage must include switching modes, searching by brand, selecting multiple batches, editing counts, and saving a pre-existing manual allocation

## Prevention Strategy

- Preserve the current auto path behind a clear branch with regression tests
- Reuse inventory-derived batch labels/details instead of re-deriving them in the view
- Validate per-row counts and duplicate selection before save, then re-check against latest available stock on submit
