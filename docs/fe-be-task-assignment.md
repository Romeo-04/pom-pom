# Hatch — frontend / backend task assignment

**Audience:** one frontend developer, one backend developer (or two small teams).  
**Rule:** every feature is a **module** with a contract, a local fallback, and a definition of done. If one module is down, the rest of Hatch still runs.

Today the app is a Vite client with `localStorage` (`src/logic/*`). This document splits that into a **client that always works** and a **server that is optional until it is healthy**.

---

## 1. How modularity works here

| Principle | What it means in practice |
| --- | --- |
| **Contract first** | FE and BE agree on JSON shapes in §3 before either waits on implementation. |
| **Local-first client** | Timer, tasks, pet stage, and tab alarm run entirely in the browser. Sync is a plugin, not the core. |
| **Degrade, don’t freeze** | API 5xx, timeout, or offline → queue writes locally, keep the session, show a quiet “offline” chip. Never block Start focus. |
| **One owner per module** | A ticket names FE or BE. Shared tickets are split into `FE-…` and `BE-…` with the same contract ID. |
| **Fail closed on auth, fail open on focus** | If login is broken, guest mode still tracks hours locally. If evolution API is broken, FE computes stage from `focusedMs` using `src/logic/evolution.js`. |

**Shared kernel (do not duplicate meaning):** `src/logic/evolution.js` and `src/logic/pomodoro.js` stay the source of truth for thresholds and cycle math. Backend **imports the same rules** (copy the files into a `packages/hatch-core` later) instead of re-deriving hours.

---

## 2. Module map

```
[ UI ]
  tasks | timer | pet | tab-guard | settings
           |         |
           v         v
[ Client adapters ]  ← FE owns; each adapter has a Memory + Http implementation
  TasksStore | SessionSync | PetAssets | Auth
           |
           v
[ HTTP /events ]  ← contract in §3; if this dies, Memory adapters still work
           |
           v
[ API modules ]  ← BE owns; independently deployable routes
  Identity | Tasks | FocusLedger | PetCatalog | Presence (optional)
```

If **FocusLedger** is down, the timer still credits `focusedMs` in Memory.  
If **PetCatalog** is down, FE uses `/pets/placeholders/{id}.svg`.  
If **Identity** is down, guest UUID in `localStorage`.  
If **Tasks** is down, today’s list stays local and syncs when the route returns.

---

## 3. Contract (v1) — freeze this before parallel work

Base path: `/api/v1`. All times in **milliseconds since epoch** (integers). Focus credit is **elapsed focus only**, never breaks.

### 3.1 Health (must exist first)

`GET /health` → `{ "ok": true, "modules": { "identity": "up", "tasks": "up", "ledger": "up", "pets": "degraded" } }`

FE uses `modules.*` to pick Memory vs Http per adapter. A module set to `"down"` or missing → that adapter stays on Memory.

### 3.2 Guest identity

`POST /sessions` `{ "deviceId": "uuid" }` → `{ "userId": "uuid", "token": "jwt-or-opaque" }`  
On failure: FE keeps `hatch.v1` as today.

### 3.3 Tasks

`GET /tasks` → `{ "tasks": [ Task ] }`  
`POST /tasks` `{ "title": string }` → `Task`  
`PATCH /tasks/:id` `{ "done"?: boolean, "active"?: boolean }` → `Task`  
`DELETE /tasks/:id` → `{ "ok": true }`

```
Task {
  id: string
  title: string
  done: boolean
  focusedMs: number
  createdAt: number
}
```

### 3.4 Focus ledger (the only writer of “real” hours when online)

`POST /focus/credits`  
`{ "idempotencyKey": string, "startedAt": number, "endedAt": number, "taskId": string | null, "phase": "focus" }`  
→ `{ "accepted": true, "focusedMs": number, "totalFocusedMs": number }`

Rules:

- Reject `phase !== "focus"`.
- Cap credit at planned duration (25 min default) — same as `creditFocusMs`.
- **Idempotency key** = `userId + startedAt` so a retry after a timeout does not double-feed the pet.

`GET /me/progress` → `{ "totalFocusedMs": number, "stageId": string, "tabGuardEnabled": boolean }`

`stageId` must match `egg | hatchling | juvenile | fledgling | adult | mythic` in `docs/gemini-pet-assets.md`.

### 3.5 Settings

`PATCH /me/settings` `{ "tabGuardEnabled": boolean }` → settings object.

### 3.6 Error envelope (all modules)

`{ "error": { "code": "UNAVAILABLE" | "VALIDATION" | "CONFLICT" | "UNAUTHORIZED", "message": string, "module": string } }`  
HTTP: 400 validation, 401 auth, 409 idempotency conflict (same key, different body), 503 module down.

---

## 4. Failure matrix (what still works)

| What broke | User can still | What they cannot |
| --- | --- | --- |
| Entire API | Add tasks, run pomodoro, evolve pet from local hours, tab alarm | Cross-device sync, backup |
| Identity only | Guest local hatch | Named account, restore on new phone |
| Tasks API only | Local task list | Shared/classroom lists |
| Focus ledger only | Local `focusedMs` + local evolution | Server-authoritative hours / anti-cheat |
| Pet asset CDN | Placeholder SVGs | Gemini PNGs |
| Tab-guard audio (autoplay) | Visual/live-region + notification if permitted | Beep |
| One FE widget (e.g. pet well) | Timer + tasks | Seeing the creature |

**Never** couple Start focus to a successful `POST /sessions`.

---

## 5. Frontend tasks

Owner: **Frontend**. Each ticket is shippable with mocks.

| ID | Task | Depends on | Fallback if blocked | Done when |
| --- | --- | --- | --- | --- |
| **FE-0** | Extract `packages/hatch-core` from `src/logic/evolution.js` + `pomodoro.js` + `tab-guard.js` (pure functions only). UI stays in `src/`. | — | Keep files where they are; just don’t put fetch inside them. | Vitest still passes; no `fetch` / `localStorage` in core. |
| **FE-1** | Introduce `adapters/memory.js` wrapping current `store.js`. All UI talks to adapters, not `localStorage` directly. | FE-0 | Leave `main.js` as-is until this lands. | Timer + tasks + pet unchanged for the user. |
| **FE-2** | Introduce `adapters/http.js` implementing the same methods as Memory (`listTasks`, `addTask`, `creditFocus`, `getProgress`, `setTabGuard`). Timeouts 3s. | FE-1, contract §3 | Ship Memory-only. | Switching `HATCH_DATA=memory\|http` in env changes backend without UI edits. |
| **FE-3** | **Health-aware router:** on boot, `GET /health`; per module pick Http or Memory. Banner: “Saved on this device only” vs “Synced”. | FE-2, **BE-0** | If `/health` fails, all Memory. | Killing the API mid-session does not stop the running pomodoro. |
| **FE-4** | Outbox: failed `creditFocus` / task writes sit in `hatch.outbox.v1` and flush every 15s when online. | FE-3 | Drop outbox; user still has local hours. | Refresh after offline credits does not lose minutes. |
| **FE-5** | Pet asset loader: try CDN URL from BE, then `public/pets/inklet-{id}.png`, then placeholder SVG (already in `setPetSrc`). | Optional **BE-4** | Placeholders only. | Missing PNG never blanks the pet well. |
| **FE-6** | Guest vs signed-in chrome (email later). Guest copy: hours stay on this browser. | **BE-1** | Hide account UI. | Focus works before login. |
| **FE-7** | Keep tab-leave alarm **client-only** (`alert-sound.js`). Do not wait on BE Presence. | — | — | Alarm still fires with API down. |
| **FE-8** | Settings checkbox persists via adapter (local + optional PATCH). | FE-2 | `localStorage` only (current). | Toggle survives reload. |
| **FE-9** | Empty / error / offline / degraded states for timer card and task list. | FE-3 | Console errors only. | No uncaught promise on 503. |

**Frontend must not:** implement a second evolution table; put pomodoro remaining time on the server; disable Start focus while `/health` is loading.

---

## 6. Backend tasks

Owner: **Backend**. Each module is its own router + datastore table. A crash in PetCatalog does not take down Tasks.

| ID | Task | Depends on | Fallback if blocked | Done when |
| --- | --- | --- | --- | --- |
| **BE-0** | Skeleton: HTTP server, `GET /health` with per-module status, 3s timeouts, CORS for the Vite origin. | — | FE stays on Memory. | `curl /health` returns JSON even if other routes 404. |
| **BE-1** | Identity module: `POST /sessions`, opaque token, guest `deviceId`. Table: `users`. If this module’s DB is down, `/health.modules.identity = "down"`; **do not** fail the whole process. | BE-0 | FE guest mode. | Token round-trip; process stays up if users table is missing (identity reports down). |
| **BE-2** | Tasks module: CRUD + `focusedMs` denormalized. Table: `tasks`. Isolated from ledger writes except via events or a function call with timeout. | BE-1 | FE local tasks. | CRUD tests; 503 if table missing, health flag `tasks: down`. |
| **BE-3** | Focus ledger: append-only `focus_credits` with unique `idempotencyKey`. Compute `totalFocusedMs` with **hatch-core** `creditFocusMs` / stage table. `GET /me/progress`. | BE-0, hatch-core copy | FE local hours. | Double POST same key returns same total; break-phase POST → 400. |
| **BE-4** | Pet catalog (static): `GET /pets/manifest` listing stage ids → URLs. Can be a JSON file on disk, no DB. | BE-0 | FE local `public/pets`. | Manifest 200; missing files still 200 with `fallback: "placeholder"`. |
| **BE-5** | Settings: `tabGuardEnabled` on `users` or `user_settings`. | BE-1 | FE local checkbox. | PATCH round-trip. |
| **BE-6** | Outbox drain endpoint (optional): `POST /sync/batch` `{ "credits": [], "tasks": [] }` for FE-4. | BE-2, BE-3 | FE retries single routes. | Batch is all-or-per-item error array; one bad credit does not reject the whole body. |
| **BE-7** | Observability: request id header, module name in error envelope, log line on 503. | BE-0 | — | One failed module is visible in `/health` without reading logs. |

**Backend must not:** store pomodoro tick-by-tick; require pet PNGs to start the API; put tab-guard audio on the server; make Tasks and Ledger share one try/catch around the whole request.

**Process isolation (recommended):** one Node/Go process is fine for v1 **if** each module has its own try/catch and health flag. Split into services only if you already operate more than one deploy.

---

## 7. Suggested order (unblocks both people)

```
Day 1  BE-0 health + FE-0/FE-1 adapters     ← parallel
Day 2  Freeze §3 in a PR comment            ← 30 min together
Day 3  BE-3 ledger + FE-2 http adapter      ← parallel against mocks
Day 4  FE-3 health router + BE-1 sessions
Day 5  BE-2 tasks + FE-4 outbox
Then   BE-4/5, FE-5/6, polish
```

**Mocks:** Backend publishes `openapi.yaml` or a static `mocks/health.json` + `mocks/progress.json` on Day 1 so FE-2 is never blocked on BE-3.

---

## 8. Definition of “modular enough to merge”

A PR is mergeable only if:

1. It touches **one module** (or contract + one module).
2. Hatch **boots and Start focus works** with `HATCH_DATA=memory`.
3. Automated test for the happy path **and** the 503 path of that module.
4. `/health` (if BE) still returns 200 when this module is intentionally disabled.

---

## 9. Ownership cheat sheet

| Surface | FE | BE |
| --- | --- | --- |
| Pomodoro clock, skip, reset | Yes | No |
| Tab leave sound / Notification | Yes | No |
| Evolution math | Shared core | Shared core |
| Authoritative hours (later) | Display | Ledger |
| Task UI | Yes | CRUD |
| Gemini PNGs | Load + fallback | Optional manifest |
| Auth chrome | Yes | Sessions |

---

## 10. Existing code to reuse (do not rewrite)

| File | Owner after split |
| --- | --- |
| `src/logic/evolution.js` | hatch-core (both) |
| `src/logic/pomodoro.js` | hatch-core (both) |
| `src/logic/tab-guard.js` | FE (client-only) |
| `src/logic/alert-sound.js` | FE |
| `src/logic/store.js` | FE Memory adapter |
| `src/main.js` | FE UI shell |
| `docs/gemini-pet-assets.md` | Design / FE assets |

---

## 11. Handoff note

Frontend can ship the whole current Hatch without waiting. Backend’s first merge is **BE-0** only. Everything after that is additive sync. If something breaks in production, set that module to `down` in `/health` — the client already knows how to keep studying.
