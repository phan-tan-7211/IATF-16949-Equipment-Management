# CEV Client Performance Architecture

This document defines the permanent client-performance standard for the CEV Equipment Management application.

The goal is not to imitate the UI of large social apps. The goal is to reproduce the interaction characteristics that make them feel immediate: retained client state, layered cache, stale-while-revalidate, optimistic updates, selective prefetch, lazy assets, and background synchronization.

## 1. Non-negotiable principles

The application should feel instant on revisit. Returning to a module must prefer already-known client data instead of showing a spinner while repeating the same server request.

Supabase remains the source of truth. Client cache exists to make rendering and navigation fast, not to create a second business database.

Do not trade correctness for speed. Cache entries must have version, timestamp, explicit invalidation rules, and bounded lifetime or size.

Do not optimize by hiding required business actions or weakening auditability.

## 2. Required data path

```text
SUPABASE
   ↓
Data Repository
   ↓
Memory Cache
   ↓
Persistent Local Snapshot
   ↓
React UI
```

### Memory cache — layer 1

Use for data already opened in the current browser session.

Expected behavior:

- revisiting Equipment / Spare / Maintenance / Inspection / Calibration / Tooling renders from memory immediately;
- tab navigation does not remount previously visited modules unnecessarily;
- cache updates after create/update/delete instead of requiring a full module reload.

### Persistent local snapshot — layer 2

Use `localStorage` for small bounded snapshots and IndexedDB when data volume or structure justifies it.

Every persisted snapshot must include:

```ts
type CacheEnvelope<T> = {
  version: number
  savedAt: number
  data: T
}
```

A cache schema change must bump `version` so incompatible stale data is discarded automatically.

## 3. Stale-while-revalidate is the default read strategy

Opening a module follows this order:

```text
1. Memory cache exists
   → render immediately
2. Else persistent snapshot exists
   → render immediately
3. Start Supabase revalidation in background
4. Compare/normalize fresh result
5. Patch the visible state/cache only when data changed
```

A background refresh must not blank the screen or replace valid content with a loading screen.

A visible loading state is appropriate only when no usable client data exists for the requested screen.

## 4. Normal mutations must not reload the whole module

Forbidden normal pattern:

```text
save record
→ await server
→ reload all equipment/spare/etc.
→ rerender entire list
```

Required pattern:

```text
user presses Save
→ optimistic local patch when safe
→ update memory cache
→ persist local snapshot
→ run Supabase RPC/write
→ success: confirm/merge returned server record
→ failure: rollback only affected record + show error
```

For create/update/delete, prefer returning the changed record or enough identifiers to patch the client cache directly.

Whole-module refetch is allowed only when the mutation invalidates an unknown large set of records and a targeted reconciliation is not reliable.

## 5. Optimistic mutation rules

Optimistic updates are preferred when rollback is deterministic.

Good candidates:

- equipment field edits;
- department / area / line / category / status changes;
- spare quantity usage where the affected record is known;
- simple create/delete with a stable temporary or final identifier.

Use a server-confirm-first flow when the action has complex validation, cross-record side effects, safety/audit consequences, or an uncertain result.

On failure:

- rollback only the affected local records;
- preserve unrelated view state;
- show a clear error;
- do not force the user back through a module reload unless required for reconciliation.

## 6. Authentication and browser lifecycle

Supabase session refresh must not control application mount state after the app is already ready.

`TOKEN_REFRESHED` must not:

- unmount the workspace;
- show the login screen;
- reset current module state;
- trigger a visible full-screen loading state.

When the browser becomes visible or focused again:

```text
keep UI mounted
→ check cache age
→ revalidate stale resources in background
→ throttle/deduplicate duplicate focus + visibility events
```

Manual user refresh may bypass the background throttle and perform a true forced server read.

## 7. Prefetch strategy

Prefetch only when there is a meaningful likelihood the user will need the target soon.

Useful triggers:

- sidebar hover/focus;
- mobile navigation focus/press intent;
- opening an Equipment Profile when Maintenance / Inspection / Spare are common next actions;
- a selected equipment whose related history is likely to be opened.

Avoid prefetching every module at startup. That simply moves latency and bandwidth to application boot.

Prefetch should prioritize:

1. route/component code;
2. lightweight master/list data;
3. detail/history only when intent is stronger.

## 8. Images and signed URLs

Equipment images must follow the immutable image contract in `AGENTS.md` and the UI/UX reference.

Performance rules:

- cache valid signed preview URLs until safely before expiry;
- lazy-load images near the visible viewport;
- do not request a signed URL for every equipment photo on every module visit;
- invalidate the corresponding cache entry immediately after same-client upload/delete;
- preserve the previous usable preview while a background refresh is in progress when possible.

For signed URLs, client TTL must remain shorter than the server URL lifetime.

## 9. Large lists and histories

Small lists may render normally.

When histories, audit logs, work orders, or events become large, use one or more of:

- server pagination;
- incremental page loading;
- windowing/virtualization;
- bounded history queries;
- detail-on-demand instead of fetching all child records for all parents.

Do not render thousands of rows merely because the query can return them.

## 10. Network request discipline

Before adding a request, ask:

- Does a shared cache already contain this entity?
- Is another component already fetching the same data?
- Can this be derived from data already present?
- Can the fetch be delayed until actual user intent?
- Can the mutation result patch local data instead of causing a second fetch?

Common regressions to reject:

- duplicate requests caused by mount + focus + visibility together;
- per-row signed URL fetches repeated on every rerender;
- full equipment reload after editing one equipment;
- full spare reload after using one spare;
- module remount on token refresh;
- spinner on returning to an already loaded tab;
- separate inconsistent caches for the same entity.

## 11. Shared cache conventions

Preferred shared primitives live under `src/data/`.

Current foundation includes the shared client cache and module-specific repositories. New modules should reuse the same design rather than inventing a local-only fetch pattern.

Cache naming convention:

```text
cev:data:<entity-or-module>
```

Every cache implementation must define:

- key;
- version;
- freshness/TTL policy;
- read snapshot function;
- write/patch function;
- invalidation function when needed;
- forced refresh behavior;
- network-error fallback behavior.

## 12. Module rollout standard

The original full-app optimization plan is the permanent baseline:

### Round 1 — Core cache + session

- stable AuthGate/session lifecycle;
- workspace keep-alive;
- shared memory + persistent snapshot cache;
- Equipment as reference implementation;
- stale-while-revalidate and background revalidation.

### Round 2 — Equipment + Spare

- no full dataset reload after common mutations;
- optimistic/local patches;
- equipment image/signed URL caching;
- Spare using the same snapshot-first behavior.

### Round 3 — Maintenance + Inspection + Calibration + Tooling

Each module must be normalized to the same repository/cache flow:

- snapshot-first render;
- background revalidate;
- targeted mutation patches;
- details/history on demand;
- no avoidable full-module reloads.

### Round 4 — Whole-app performance audit

Audit:

- duplicate network requests;
- stale cache/invalidation correctness;
- lazy loading and code splitting;
- intent prefetch;
- large-list virtualization/pagination;
- browser tab return;
- auth token refresh;
- offline/slow-network behavior;
- optimistic rollback;
- image signed URL reuse;
- module revisit without spinner.

After these four rounds, every future feature must preserve these properties. Performance is not a cleanup phase; it is part of feature acceptance.

## 13. Definition of done for data-driven features

A data-driven feature is not complete until the implementation answers all of the following:

- What is the memory cache behavior?
- What persistent snapshot, if any, is used?
- What makes the data stale?
- How is background revalidation triggered and throttled?
- How does create/update/delete patch local state?
- What is the rollback behavior?
- Does browser focus/token refresh leave the UI mounted?
- Are duplicate requests avoided?
- Are images/large lists loaded only as needed?
- Does revisiting the module show usable content immediately?

If a feature intentionally violates one of these rules, the PR must document the reason and the expected performance impact.

## 14. Reference behavior

### Open Equipment

```text
open Equipment
→ memory snapshot available: render immediately
→ otherwise local snapshot: render immediately
→ fetch Supabase in background
→ patch changed rows only
```

### Edit Equipment

```text
press Save
→ update visible row immediately
→ update memory/local cache
→ run RPC
→ success: merge canonical server result
→ failure: rollback edited row + error
```

### Return to browser tab

```text
no login flash
no module remount
no state reset
→ stale check
→ background revalidate only when needed
```

This behavior is the expected default across the entire CEV application.
