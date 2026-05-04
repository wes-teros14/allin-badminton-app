# Phase 9: Inventory Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 09-inventory-management
**Areas discussed:** Batch form fields, Stock list display, Batch deletion, Navigation / access

---

## Batch Form Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Brand + tube count + cost/tube only | Core fields, auto-timestamp purchase date | |
| Add purchase date field | Admin can backdate a batch | |
| Add notes field too | All fields including purchase date + notes | ✓ (partial) |

**User's choice:** Options 1 and 3 combined — brand + tube count + cost/tube + optional notes. No purchase date field (auto-timestamp on insert).

---

## Tube ID System

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-assign on batch add | System assigns T-1001, T-1002, etc. sequentially | ✓ |
| Admin types the tube ID range | Admin enters starting ID manually | |
| No tube IDs — just batch numbers | Simple B-001, B-002 batch identifiers | |

**User's choice:** Auto-assign. Admin never types tube IDs.

---

## Stock List Display

| Option | Description | Selected |
|--------|-------------|----------|
| Table with key columns | ID \| Brand \| Tubes bought \| Stock remaining \| Cost/tube \| Notes | ✓ |
| Cards grid | One card per batch | |
| Table + expand for notes | Compact table with expandable rows | |

**User's choice:** Table layout.

---

## Depleted Batch Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show with Depleted badge | Stays in list with gray/muted badge | ✓ |
| Hide depleted automatically | Toggle/filter reveals depleted ones | |
| Show strikethrough row | Depleted rows struck through | |

**User's choice:** Depleted badge — full history always visible.

---

## Batch Deletion

| Option | Description | Selected |
|--------|-------------|----------|
| No deletion — depletion only | Permanent history, no delete action | ✓ |
| Delete only if zero usage | Allow delete for fresh zero-usage entries | |
| Soft delete with archive | Archive hides from active list | |

**User's choice:** No deletion. Batches are permanent.

---

## Navigation / Access

| Option | Description | Selected |
|--------|-------------|----------|
| AdminView gets an Inventory button | Button in existing AdminView | |
| Finance tab link only | Accessible from Finance tab | |
| Both AdminView and Finance tab | Two entry points | |
| Top nav tab, admin-only | First-class tab in TopNavBar | ✓ |

**Notes:** User questioned the AdminView recommendation and proposed a top-level tab alongside Admin and Players. Claude confirmed TopNavBar is the right pattern. Single top-level entry point, admin-gated.

---

## Claude's Discretion

- Depleted badge exact color/variant
- Form validation error message wording
- Empty state copy (no batches yet)
- Loading skeleton design

## Deferred Ideas

- Batch editing post-creation
- Low stock alerts (post-v1.1)
- Purchase date backdating
- Finance tab shortcut to /inventory
