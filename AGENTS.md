# AGENTS.md — Backup Pro

## Project

MCP server for file backup/versioning. TypeScript, Node.js, vitest. 17 tools, 760+ tests.

## Commands

```bash
pnpm run build      # tsc + chmod dist/index.js
pnpm test           # vitest run (760+ tests, ~1.3s)
pnpm run lint       # eslint src/
pnpm exec tsc --noEmit   # typecheck only
pnpm run watch      # tsc --watch
pnpm run inspector  # MCP inspector for debugging
```

Run lint + typecheck after every source file change. Run tests before commit.

## Architecture

```
src/
├── index.ts              # Server entry, MCP handlers, rate limiter
├── operations/           # Business logic (one file per domain)
│   ├── filter-utils.ts   # SSOT: shared filter+sort (list + search)
│   ├── create.ts         # Atomic backup creation (copyAtomic + streaming hash)
│   ├── restore.ts        # Atomic restore (temp + rename)
│   ├── diff.ts           # LCS diff comparison
│   ├── get.ts            # mtime short-circuit for hash cache
│   ├── cleanup.ts        # cutoffDate computed once per run, parallel stats
│   └── ...
├── search/               # Ripgrep integration
│   ├── ripgrep-executor.ts # Semaphore-limited, env-validated, byte-capped
│   ├── ripgrep-args.ts    # Argument builder (only used methods)
│   └── ripgrep-types.ts   # Result types
├── tools/                # MCP tool definitions
│   └── types.ts          # ToolDefinition with readOnly flag
├── types/                # TypeScript interfaces
├── validation/           # Regex validation
└── utils/                # Store, persistence, hashing, config, logger
    ├── concurrency.ts    # Semaphore, parallelMap, rate limiter (re-check after sleep)
    ├── config.ts         # Env-var parsing, SERVER_VERSION from package.json
    ├── fs.ts             # copyAtomic, writeFileAtomic, hashFile (streaming 1MB)
    ├── myers-diff.ts     # LCS DP (Int32Array), n*m capped at 10M
    ├── store.ts          # BackupStore (in-memory + auto-save)
    ├── persistence.ts    # Schema v1→v2 migration, HMAC integrity, atomic writes
    ├── hashing.ts        # Backup ID + filename generation
    └── validate.ts       # Path traversal + root restriction + validateMetadataPath
```

## Conventions

- **SSOT**: No duplicate state, config, or logic. `config.batchConcurrency` is the canonical concurrency knob. `SERVER_VERSION` reads package.json. Filters live in `filter-utils.ts`.
- **Atomic writes**: `copyAtomic` / `writeFileAtomic` for all file operations that readers may see. Never write directly to final path.
- **Error handling**: `toMcpError()` wraps all errors. Never swallow errors in critical paths.
- **readOnly tools**: 10 read-only tools skip `backupRateLimiter`. Add `readOnly: true` to `ToolDefinition` for new read-only tools.
- **Path security**: `sanitizePath` in all error messages. `validateFilePath` before any filesystem access. `validateMetadataPath` for persisted paths (only when path exists on disk).
- **Diff guard**: `myers-diff.ts` rejects inputs where `n * m > 10_000_000`.
- **Env validation**: All `Number.parseInt` env vars validated ≥1 (concurrency) or ≥0 (limits). Invalid values fall back to defaults, never NaN/0.
- **Hashing**: `hashFile()` streams 1MB chunks — never load whole files for hashing. Hash failure during create is a warning, not fatal.

## Testing

- 50 test files, 760+ tests, ~1.3s runtime
- `edge-cases.test.ts` — path traversal, schema migration, cleanup edge cases
- `legacy-metadata.test.ts` — v1 flat-record load, HMAC tamper detection
- `fs-error-branches.test.ts` / `ripgrep-error-branches.test.ts` — error paths
- `e2e.test.ts` tests full MCP server tool handlers
- `benchmark.test.ts` asserts performance thresholds (100 backups < 2s, diff 1000 lines < 300ms)

## Key Files

| File | Purpose |
|---|---|
| `src/index.ts` | Server entry, tool dispatch, rate limiter |
| `src/utils/config.ts` | All env vars + defaults, `SERVER_VERSION` |
| `src/utils/store.ts` | `BackupStore` — in-memory map + auto-save |
| `src/utils/fs.ts` | `copyAtomic`, `writeFileAtomic`, `safeOpenAndVerify` |
| `src/utils/validate.ts` | `validateFilePath`, `validateMetadataPath`, `sanitizePath` |
| `src/operations/filter-utils.ts` | `applyFiltersAndSort` — shared by list + search |
| `src/tools/types.ts` | `ToolDefinition` interface with `readOnly` flag |

## Environment Variables

See README.md → Configuration → Environment Variables.

Critical: `BACKUP_ALLOWED_ROOTS` defaults to `[cwd]` when unset (not open). `BATCH_CONCURRENCY` minimum is 1.

## Do NOT

- Hardcode concurrency values — use `config.batchConcurrency`
- Write backup files non-atomically — use `copyAtomic`
- Expose raw paths in errors — use `sanitizePath`
- Skip `validateFilePath` before filesystem access
- Add `any` types or `@ts-ignore`
- Chain multiple `edit_file` calls on the same file — use `write_file`