# Phase 17: Manual Batch Allocation UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 17-manual-batch-allocation-ui
**Areas discussed:** Picker surface, Search and result presentation, Selected allocation rows, Reopening saved manual allocations

---

## Picker Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on the finance card | Search and results live directly inside the finance card. | |
| Open a picker dialog | Search and results live in a dialog opened from manual mode. | ✓ |
| Split layout | Selected rows inline, search in a dialog or sheet. | |

**User's choice:** Open a picker dialog.
**Notes:** The user asked for an explanation of a picker dialog, then confirmed that the batch search should use that pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| One-tap add | Each result adds immediately into the manual allocation list. | ✓ |
| Multi-select then confirm | Select several rows, then confirm once. | |
| One batch per open | Pick one batch, close, and reopen for more. | |

**User's choice:** One-tap add.
**Notes:** Adding from the dialog should immediately place the batch into the finance page allocation table.

| Option | Description | Selected |
|--------|-------------|----------|
| Full inventory-style row | Show tube ID, brand, stock, cost, and notes. | ✓ |
| Compact expandable row | Show essentials first, expand for more. | |
| Medium row | Show most fields inline, notes separately. | |

**User's choice:** Full inventory-style row.
**Notes:** The user wants the picker results to match the inventory detail level directly.

---

## Search And Result Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Live filter while typing | Results narrow immediately as the QM types. | ✓ |
| Search on submit | Filter only after explicit search action. | |
| Show all first, then filter | Start with all rows and narrow while typing. | |

**User's choice:** Live filter while typing.
**Notes:** Search should feel immediate instead of form-submit based.

| Option | Description | Selected |
|--------|-------------|----------|
| Contains match | Match the brand anywhere in the string. | ✓ |
| Starts-with match | Match only from the beginning of the brand. | |
| Exact match only | Require full exact brand name. | |

**User's choice:** Contains match.
**Notes:** The user wants forgiving search behavior.

| Option | Description | Selected |
|--------|-------------|----------|
| All available batches | Show the full available list when empty. | |
| No results until typing | Empty state until a query exists. | |
| Default suggestions | Show a curated default subset first. | ✓ |

**User's choice:** Default suggestions.
**Notes:** The user prefers a guided default list over showing everything immediately.

| Option | Description | Selected |
|--------|-------------|----------|
| Lowest tube IDs first | Inventory-like order. | |
| Highest stock first | Surface the fullest batches first. | |
| Cheapest first | Surface lowest cost batches first. | ✓ |

**User's choice:** Cheapest first.
**Notes:** Cheapest-first ordering is preferred for the default empty-search suggestions.

---

## Selected Allocation Rows

| Option | Description | Selected |
|--------|-------------|----------|
| Editable table | Table rows with details, count input, and actions. | ✓ |
| Card list | One card per batch. | |
| Compact list | Slimmer list with fewer details. | |

**User's choice:** Editable table.
**Notes:** The user wants the selected manual allocation to stay table-based.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep add order | Preserve the order the QM added rows. | ✓ |
| Inventory order | Auto-sort to stable inventory order. | |
| Cheapest first | Auto-sort to cost order. | |

**User's choice:** Keep add order.
**Notes:** Selection order should remain user-driven.

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately as counts change | Recalculate total live. | ✓ |
| After leaving the input | Recalculate on blur. | |
| Only after save | Recalculate after submit. | |

**User's choice:** Immediately as counts change.
**Notes:** The total should update live during editing.

| Option | Description | Selected |
|--------|-------------|----------|
| Remove immediately | Delete the row right away. | |
| Remove with confirmation | Require confirmation before deleting. | ✓ |
| Clear count instead of remove | Keep the row but reset count. | |

**User's choice:** Remove with confirmation.
**Notes:** The user first chose immediate remove, then clarified it should still include confirmation.

---

## Reopening Saved Manual Allocations

| Option | Description | Selected |
|--------|-------------|----------|
| Prefilled editable table only | Show saved rows first and let the QM add more if needed. | ✓ |
| Prefilled table plus prompt | Show saved rows and prompt for adding more right away. | |
| Open picker first | Start in search before showing existing rows. | |

**User's choice:** Prefilled editable table only.
**Notes:** Reopening should land directly on the manual allocation table.

| Option | Description | Selected |
|--------|-------------|----------|
| Restore them as current editable state | Load saved rows directly into the editable form. | ✓ |
| Show read-only history first | Require an extra edit action. | |
| Show summary first | Expand into edit mode on demand. | |

**User's choice:** Restore them as current editable state.
**Notes:** The user asked for clarification, then chose direct editable restoration.

| Option | Description | Selected |
|--------|-------------|----------|
| No distinction | Saved and newly added rows look the same while editing. | ✓ |
| Subtle distinction | Mark newly added rows with a small badge or highlight. | |
| Full change tracking | Show detailed added/changed/removed states. | |

**User's choice:** No distinction.
**Notes:** The table should behave as one current editable state, not an audit view.

## the agent's Discretion

- Dialog dimensions and responsive layout details
- Exact copy and helper text
- Exact confirmation component for row removal

## Deferred Ideas

- Validation and save blocking for duplicates, invalid counts, empty manual allocations, and stock overflow belong to Phase 18.
- Additional search filters beyond brand remain out of scope.
