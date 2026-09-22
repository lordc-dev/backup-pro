# Architecture — Backup Pro

## Overview

Backup Pro is an MCP (Model Context Protocol) server that provides file versioning for AI-assisted development. It runs as a stdio process, exposing 17 tools that AI agents (Claude, Cursor, etc.) call to backup, restore, diff, and search file versions.

## Design Principles

1. **Atomicity** — All file writes go through `copyAtomic` or `writeFileAtomic` (temp file + rename). Readers never see partial files.
2. **SSOT** — Single source of truth for concurrency (`config.batchConcurrency`), version (`SERVER_VERSION`), filter+sort logic (`filter-utils.ts`).
3. **Defense in depth** — Path validation at entry (`validateFilePath`), at metadata persistence (`validateMetadataPath`), and at file access (`safeOpenAndVerify` with TOCTOU guard).
4. **Graceful degradation** — Missing ripgrep → `search_backup_content` returns "unavailable". Missing hash → verify reports "no stored hash". Invalid env vars → fall back to defaults, never crash or deadlock.
5. **Read/write separation** — Read-only tools skip the rate limiter, keeping exploratory agents responsive. Write tools are rate-limited (60/60s).

## Layering

```
┌─────────────────────────────────────────┐
│  MCP Client (Claude, Cursor, ...)        │
└──────────────┬──────────────────────────┘
               │ JSON-RPC over stdio
┌──────────────▼──────────────────────────┐
│  index.ts  (Server + Tool Dispatch)      │
│  • Rate limiter (write tools only)       │
│  • Tool → handler routing                │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  tools/  (MCP Tool Definitions)          │
│  • Input schema validation               │
│  • readOnly flag                         │
│  • Handler → operation call              │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  operations/  (Business Logic)           │
│  • create, restore, diff, get, list      │
│  • search, cleanup, delete, batch        │
│  • filter-utils.ts (shared filter+sort)  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  utils/  (Infrastructure)                │
│  • store.ts (BackupStore)                │
│  • persistence.ts (schema migration)     │
│  • fs.ts (atomic I/O)                    │
│  • config.ts (env parsing)               │
│  • concurrency.ts (Semaphore)            │
│  • validate.ts (path security)           │
│  • hashing.ts (SHA-256)                  │
│  • myers-diff.ts (LCS diff)              │
└──────────────────────────────────────────┘
```

## Data Flow

### Backup Creation

```
create_backup(filePath)
  → validateFilePath(filePath, allowedRoots)
  → assertFileSize(filePath, maxFileSize)
  → generateBackupId() + backupPath
  → copyAtomic(filePath, backupPath)       // temp + rename
  → hashFile(backupPath)                    // SHA-256, streaming 1MB chunks
  → store.create(metadata)
  → persistAfter()                          // debounced auto-save
  → return { backupId, backupPath }
```

### Restore

```
restore_backup(backupId, targetPath?)
  → store.get(backupId)
  → validateMetadataPath(backupPath)
  → copyAtomic(backupPath, targetPath ?? originalPath)
  → return { restoredPath, originalPath }
```

### Diff

```
diff_backup(backupId, compareWith?)
  → read backup content (assertFileSize maxDiffSize)
  → read current file OR compareWith backup content
  → diffLines(oldContent, newContent)
    → myers-diff.ts: LCS DP (n*m capped at 10M)
    → returns added/removed/unchanged line ranges
  → formatDiffResult()
```

### Search (ripgrep)

```
search_backup_content(pattern)
  → check ripgrep installed
  → rgSemaphore.acquire()
  → spawn ripgrep with timeout (MCP_RG_TIMEOUT_MS)
  → parse JSON output
  → rgSemaphore.release()
  → return matches[]
```

## Concurrency Model

- **Semaphore** (`utils/concurrency.ts`) — counting semaphore for parallel limits
- **parallelMap** — maps array with bounded concurrency via Semaphore
- **Rate limiter** — token bucket (60/60s) applied to write tools only; read tools bypass via `readOnly: true`
- **batchConcurrency** — `config.batchConcurrency` drives all batch/dedup/stats parallelism
- **MAX_CONCURRENT_RG** — separate semaphore for ripgrep processes (default 8)

## Persistence

- **metadata.json** — single JSON file with all backup metadata
- **Schema v2** — current; v1→v2 migration on load (`persistence.ts`)
- **Atomic writes** — `writeFileAtomic` (temp + rename) prevents corruption
- **Auto-save** — debounced save every `AUTO_SAVE_INTERVAL_MS` when store is dirty
- **Backup files** — `{name}.{id}.{iso-timestamp}.backup` in `BACKUP_DIR`

## Security

| Layer | Mechanism |
|---|---|
| Input validation | `validateFilePath` — rejects `..`, `~`, symlinks outside roots |
| Metadata validation | `validateMetadataPath` — checks persisted paths on disk |
| TOCTOU guard | `safeOpenAndVerify` — opens fd first, then fstat to verify identity |
| Error sanitization | `sanitizePath` — redacts full paths in MCP error messages |
| Root restriction | `BACKUP_ALLOWED_ROOTS` — colon-separated allowed directories |
| Integrity | HMAC-SHA256 over metadata.json (sorted keys), verified on load; SHA-256 hash stored in metadata, verified on `verify_backup` |

## Error Handling

- **McpError** — SDK error type, thrown by all operations/tools
- **toMcpError()** — converts unknown errors to `McpError` with correct `ErrorCode`
- **No swallowed errors** — critical paths rethrow, never catch-and-ignore

## Testing

| Suite | Tests | Coverage |
|---|---|---|
| operations.test.ts | 12 | create, list, search, diff, preview, verify, cleanup, stats, duplicates |
| operations-extra.test.ts | 23 | get details, verify edge cases, stats with real data |
| edge-cases.test.ts | 116 | path traversal, schema migration, cleanup edge cases |
| e2e.test.ts | 5 | full MCP server tool dispatch |
| benchmark.test.ts | 5 | performance thresholds |
| create/delete/batch | 26 | CRUD operations |
| ripgrep suites | 99 | ripgrep executor, args, content search |
| tools-extra.test.ts | 19 | tool handler edge cases |
| legacy-metadata.test.ts | 6 | v1 flat-record load, HMAC tamper detection |
| fs/rg error branches | 22 | hashFile, assertFileSize, atomic cleanup, rg limits |
| **Total** | **740+** | **47 test files** |

## Configuration

All config in `src/utils/config.ts`:

| Env Var | Default | Validator |
|---|---|---|
| `BACKUP_DIR` | `~/.mcp-backups` | — |
| `BACKUP_ALLOWED_ROOTS` | `[cwd]` | — |
| `BATCH_CONCURRENCY` | `5` | `≥1` |
| `MAX_CONCURRENT_RG` | `8` | `≥1` |
| `MCP_RG_TIMEOUT_MS` | `30000` | `≥1000` |
| `MAX_FILE_SIZE` | `100MB` | `≥1` |
| `MAX_DIFF_SIZE` | `10MB` | `≥1` |
| `MAX_HASH_SIZE` | `100MB` | `≥1` |
| `AUTO_SAVE_INTERVAL_MS` | `30000` | `≥1` |
| `MAX_PREVIEW_CHARS` | `10000` | `≥1` |
| `MAX_BACKUPS_PER_FILE` | `0` | `≥0` |
| `LOG_LEVEL` | `info` | enum |