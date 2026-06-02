# AGENTS.md — backup-pro MCP Server

**Source**: `~/.config/opencode/mcp/backup-pro`

## Architecture

```
src/
├── index.ts              # Server entry, MCP handlers, resource/health endpoints
├── tools/
│   ├── backup-tools.ts   # create, restore, delete, cleanup, batch, preview, diff
│   ├── query-tools.ts    # list, search, get, stats, verify, find_duplicates, search_content
│   └── tag-tools.ts      # list_tags, add_tags, remove_tags
├── operations/           # Core logic (one file per tool)
├── utils/
│   ├── store.ts          # BackupStore (Map<string, BackupInfo> + dirty tracking + auto-save)
│   ├── persistence.ts    # metadata.json load/save, migration v1→v2
│   ├── hashing.ts         # ID generation, SHA-256 file hash
│   ├── myers-diff.ts      # Diff algorithm for diff_backup
│   ├── config.ts          # Env-driven config (BACKUP_DIR, roots, log level, etc.)
│   └── validate.ts        # Input validation helpers
├── types/index.ts         # All TypeScript interfaces (BackupInfo, *Params, *Result)
└── errors/index.ts        # McpError factories
```

**Storage**: `~/.mcp-backups/` (configurable via `BACKUP_DIR` env)

- `metadata.json` — schema v2, all backup metadata
- `<hash-based-filename>` — backup file copies

## Tools — When & How

### Create & Restore

| Tool             | When                       | Key Params                                                                         | Notes                                                                 |
| ---------------- | -------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `create_backup`  | Before modifying any file  | `filePath` (required), `tags[]`, `description`, `relatedFiles[]`, `projectContext` | Always backup before edits. Returns `backupId`.                       |
| `batch_backup`   | Before multi-file changes  | `filePaths[]` (required), `tags[]`, `description`, `projectContext`                | Parallel, shared tags. 5 concurrent by default (`BATCH_CONCURRENCY`). |
| `restore_backup` | Roll back to a known state | `backupId` (required), `targetPath` (optional — restore elsewhere)                 | Overwrites target by default. Use `targetPath` for safe restore.      |

### Query & Search

| Tool                    | When                                  | Key Params                                                                                    | Notes                                                             |
| ----------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `list_backups`          | Find backups for a file/date range    | `filePath`, `tags[]`, `afterDate`, `beforeDate`, `searchTerm`, `limit`, `sortBy`, `sortOrder` | `sortBy`: date/size/name. Default: date desc.                     |
| `get_backup`            | Full metadata for one backup          | `backupId`                                                                                    | Includes size, hash, tags, timestamps.                            |
| `get_backup_stats`      | Overview: total count, size, top tags | —                                                                                             | Use before cleanup to understand scope.                           |
| `search_backups`        | Find by content/description           | `query` (required), `searchIn[]` (description/tags/filename/all), `tags[]`, `dateRange`       | `searchIn` default: all.                                          |
| `search_backup_content` | Ripgrep inside backup files           | `pattern` (regex), `ignoreCase`, `maxResults`, `contextLines`                                 | Requires ripgrep installed. Searches file contents, not metadata. |

### Tags

| Tool          | When                      | Key Params           |
| ------------- | ------------------------- | -------------------- |
| `list_tags`   | See all tags in use       | —                    |
| `add_tags`    | Categorize after creation | `backupId`, `tags[]` |
| `remove_tags` | Clean up mislabeled       | `backupId`, `tags[]` |

### Diff & Preview

| Tool             | When                                                  | Key Params                                     | Notes                                                         |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `preview_backup` | Inspect content without restoring                     | `backupId`, `head`, `tail`, `maxChars`         | Use `head`/`tail` for large files. Default `maxChars`: 10000. |
| `diff_backup`    | Compare backup vs current file (or vs another backup) | `backupId`, `compareWith` (optional backup ID) | Uses Myers diff. No `compareWith` = diff vs live file.        |

### Maintenance

| Tool              | When                                          | Key Params                                                                        | Notes                                                                        |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `verify_backup`   | Check integrity after restore or periodically | `backupId`                                                                        | Compares stored SHA-256 hash. Detects corruption.                            |
| `find_duplicates` | Reclaim wasted space                          | —                                                                                 | Groups by content hash.                                                      |
| `cleanup_backups` | Prune old/excessive backups                   | `keepLast`, `olderThan` (e.g. `7d`, `24h`), `filePath`, `dryRun`, `excludeTags[]` | Always `dryRun: true` first. Use `excludeTags` to protect important backups. |
| `delete_backup`   | Remove one specific backup                    | `backupId`                                                                        | Returns freed space.                                                         |

## Workflow Patterns

### Before Editing Files

```
1. create_backup(filePath, {tags: ["pre-edit"], description: "why"})
2. Edit file
3. diff_backup(backupId) — verify changes
```

### Multi-File Changes

```
1. batch_backup(filePaths, {tags: ["pre-refactor"], description: "refactor X"})
2. Edit files
3. list_backups({tags: ["pre-refactor"]}) — find all related backups
```

### Rollback

```
1. list_backups({filePath: "/path/to/file"})
2. preview_backup(backupId) — confirm correct version
3. restore_backup(backupId) — or restore_backup(backupId, {targetPath: "/safe/location"})
```

### Cleanup

```
1. get_backup_stats() — see scope
2. cleanup_backups({olderThan: "30d", dryRun: true}) — preview
3. cleanup_backups({olderThan: "30d", keepLast: 3, excludeTags: ["important")})
4. find_duplicates() — check for redundant backups
```

## Environment Variables

| Variable                | Default          | Purpose                                   |
| ----------------------- | ---------------- | ----------------------------------------- |
| `BACKUP_DIR`            | `~/.mcp-backups` | Where backups and metadata.json live      |
| `BACKUP_ALLOWED_ROOTS`  | (all paths)      | Colon-separated roots for path validation |
| `LOG_LEVEL`             | `info`           | debug/info/warn/error                     |
| `AUTO_SAVE_INTERVAL_MS` | `30000`          | Metadata auto-save frequency              |
| `MAX_PREVIEW_CHARS`     | `10000`          | Preview content character limit           |
| `BATCH_CONCURRENCY`     | `5`              | Parallel file copies in batch_backup      |

## Rules for LLM Agents

1. **Always backup before edits** — `create_backup` or `batch_backup` before any file modification.
2. **Use tags purposefully** — Tag with intent: `["pre-edit", "critical", "before-refactor"]`.
3. **Verify after restore** — Run `verify_backup` to confirm integrity.
4. **Dry-run cleanup first** — Always `cleanup_backups({dryRun: true})` before real cleanup.
5. **Use `search_backup_content` for code patterns** — Faster than restoring + reading.
6. **Use `diff_backup` instead of manual comparison** — Shows additions/deletions count.
7. **Limit preview scope** — Use `head`/`tail` for large files to avoid token waste.
8. **Check stats before bulk operations** — `get_backup_stats` gives total count and size.
9. **Exclude critical tags from cleanup** — `excludeTags: ["important", "pinned"]` prevents accidental deletion.
10. **Metadata is auto-saved** — `persistAfter` flag on create/delete/cleanup/tag ops. No manual save needed.

## Companion Project

[**Filesystem Pro**](https://github.com/lordc-dev/filesystem-pro) — give AI real developer access to your codebase. Ripgrep search, tree-sitter code understanding in 17 languages, AST-based surgical edits, and a full undo stack. Backup Pro versions your files; Filesystem Pro gives AI the tools to edit them safely.

## Build & Test

```bash
cd ~/.config/opencode/mcp/backup-pro
pnpm install
pnpm build      # TypeScript → dist/
pnpm test       # Vitest
```
