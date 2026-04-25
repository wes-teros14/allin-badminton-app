---
title: 'Floating Notification System for Cheers & Awards'
slug: 'notification-system'
created: '2026-03-23'
status: 'Implementation Complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'Supabase', 'Tailwind CSS v4', 'Sonner']
files_to_modify:
  - badminton-v2/supabase/migrations/029_create_notifications.sql (new)
  - badminton-v2/src/types/database.ts
  - badminton-v2/src/contexts/NotificationContext.tsx (new)
  - badminton-v2/src/layouts/PlayerLayout.tsx
  - badminton-v2/src/components/TopNavBar.tsx
  - badminton-v2/src/views/ProfileView.tsx
  - badminton-v2/src/App.tsx
code_patterns: []
test_patterns: []
---

# Tech-Spec: Floating Notification System for Cheers & Awards

**Created:** 2026-03-23

## Overview

### Problem Statement

Players have no way to know when they receive cheers or earn awards unless they manually check their profile. There's no "pull" to come back and check — no engagement loop.

### Solution

A `notifications` table with a DB trigger that auto-creates notification rows when cheers are received. On the frontend: batch summary toast on app open, real-time individual toasts when cheers arrive, and a yellow badge dot on the My Profile tab.

### Scope

**In Scope:**
- `notifications` table + DB trigger on cheers insert
- NotificationContext with real-time subscription
- Batch summary toast on app open for unseen notifications
- Real-time individual toast showing cheer type + giver name
- Yellow badge dot on My Profile tab in TopNavBar
- Mark as read when visiting Profile
- Tap toast → navigate to /profile

**Out of Scope:**
- Push notifications (browser/mobile)
- Notification history/feed page
- Notification preferences/settings
- Email notifications
- Award notifications (Phase 2)

## Implementation

### Migration 029
- `notifications` table: id, user_id, type, title, body, related_id, read_at, created_at
- RLS policies for SELECT and UPDATE
- Realtime enabled (REPLICA IDENTITY FULL)
- Trigger `on_cheer_notify` on cheers INSERT → creates notification with cheer slug + giver name

### NotificationContext
- Fetches unread count on mount
- Shows batch summary toast after 500ms delay
- Real-time subscription for new INSERT events on notifications table
- `markAllRead()` sets read_at on all unread notifications
- `unreadCount` drives badge dot in TopNavBar

### TopNavBar Badge
- Yellow dot (#FEFE6A) on My Profile tab when unreadCount > 0

### ProfileView
- Calls `markAllRead()` on mount to clear badge

### Toast Position
- Toaster moved to bottom-center for mobile-first UX
