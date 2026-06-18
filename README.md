# Backup Pro

[English](../README.md) | [Español](docs/README.es.md) | [Català](docs/README.ca.md) | [Galego](docs/README.gl.md) | [Euskara](docs/README.eu.md) | [Français](docs/README.fr.md) | [Português](docs/README.pt.md)

**Every time AI edits your code, you risk losing the original.** Backup Pro fixes that — version every file before AI touches it, search and diff backups instantly, restore with one click. SHA-256 integrity, deduplication, batch operations. 17 tools. Works with Claude, Cursor, and any MCP-compatible AI.

> **Enhanced fork** of the [Anthropic MCP Backup Server](https://github.com/modelcontextprotocol/servers) — file versioning, tags, search, diff, verification, deduplication, and batch operations.

_Built and maintained by:_

[![LinkedIn](https://img.shields.io/badge/LinkedIn-albertocastrootero-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/albertocastrootero)

---

## Why Backup Pro?

- **AI edited your file and now it's broken?** — one click to restore any previous version. Every backup is a checkpoint you can return to
- **Need to find what changed?** — diff any backup against the current file or another backup. See exactly what was added, removed, or changed
- **Editing many files at once?** — batch backup before refactoring. Shared tags and description across all files, one operation
- **Worried about corruption?** — SHA-256 hash verification detects any bit-level change. Verify after restore, verify anytime
- **Wasting disk space on duplicates?** — find identical backups and reclaim space. Deduplication built in

---

## Installation

### 1. Install ripgrep (optional — for `search_backup_content`)

| Platform             | Command                                  |
| -------------------- | ---------------------------------------- |
| **macOS**            | `brew install ripgrep`                   |
| **Debian/Ubuntu**    | `sudo apt install ripgrep`               |
| **Fedora**           | `sudo dnf install ripgrep`               |
| **Arch**             | `sudo pacman -S ripgrep`                 |
| **Windows (winget)** | `winget install BurntSushi.ripgrep.MSVC` |
| **Windows (scoop)**  | `scoop install ripgrep`                  |
| **Windows (choco)**  | `choco install ripgrep`                  |

> Without ripgrep, all tools work except `search_backup_content`.

### 2. Install and build the server

```bash
cd /path/to/backup-pro
npm install
npm run build
```

## Configuration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "backup-pro": {
      "command": "node",
      "args": ["/path/to/backup-pro/dist/index.js"],
      "env": {
        "BACKUP_ALLOWED_ROOTS": "/Users/you/projects:/home/you/code"
      }
    }
  }
}
```

### Environment Variables

#### Safety

| Variable               | Default          | Description                                                    |
| ---------------------- | ---------------- | -------------------------------------------------------------- |
| `BACKUP_ALLOWED_ROOTS` | (all paths)      | Keep AI inside your project directories. Colon-separated roots |
| `BACKUP_DIR`           | `~/.mcp-backups` | Where backups and metadata are stored                          |

#### Limits

| Variable                | Default   | Description                                                              |
| ----------------------- | --------- | ------------------------------------------------------------------------ |
| `AUTO_SAVE_INTERVAL_MS` | `30000`   | How often metadata auto-saves (ms)                                       |
| `MAX_PREVIEW_CHARS`     | `10000`   | Max characters in preview — keeps context from exploding                 |
| `BATCH_CONCURRENCY`     | `5`       | Max parallel file copies in batch operations (min: 1)                   |
| `MAX_BACKUPS_PER_FILE`  | `0`       | Max backups per file before cleanup warns (0 = unlimited)                |
| `MAX_FILE_SIZE`         | `104857600` | Max file size for backup operations (100 MB default)                   |
| `MAX_DIFF_SIZE`         | `10485760`  | Max file size for diff operations (10 MB default)                      |
| `MAX_HASH_SIZE`         | `104857600` | Max file size for hash computation in get/verify (100 MB default)      |

#### Search (ripgrep)

| Variable                | Default  | Description                                                |
| ----------------------- | -------- | ---------------------------------------------------------- |
| `MCP_MAX_CONCURRENT_RG` | `8`      | Max concurrent ripgrep processes (min: 1)                  |
| `MCP_RG_TIMEOUT_MS`     | `30000`  | Ripgrep process timeout in ms (min: 1000)                  |

#### Debugging

| Variable    | Default | Description                                 |
| ----------- | ------- | ------------------------------------------- |
| `LOG_LEVEL` | `info`  | Verbosity: `debug`, `info`, `warn`, `error` |

---

## Tools (17)

### Create & Restore

| Tool             | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `create_backup`  | Backup a file before AI touches it. Add tags and description for context |
| `batch_backup`   | Backup many files at once. Shared tags, one operation                    |
| `restore_backup` | Restore to any previous version. Optionally to a different path          |

### Find & Search

| Tool                    | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `list_backups`          | Find backups by file, tags, date range, or search term      |
| `search_backups`        | Search by description, tags, or filename                    |
| `get_backup`            | Full metadata for one backup — size, hash, tags, timestamps |
| `get_backup_stats`      | Overview: how many backups, total size, top tags            |
| `search_backup_content` | Search inside backup files with ripgrep (optional)          |

### Compare & Preview

| Tool             | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `diff_backup`    | Compare a backup vs current file — or vs another backup                  |
| `preview_backup` | Read backup content without restoring. Use `head`/`tail` for large files |

### Tags

| Tool          | Description                        |
| ------------- | ---------------------------------- |
| `add_tags`    | Categorize a backup after creation |
| `remove_tags` | Clean up mislabeled backups        |
| `list_tags`   | See all tags in use                |

### Maintenance

| Tool              | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `verify_backup`   | Check SHA-256 hash integrity — detect corruption           |
| `find_duplicates` | Find backups with identical content — reclaim wasted space |
| `cleanup_backups` | Prune old or excessive backups. `dryRun` first to preview  |
| `delete_backup`   | Remove one specific backup                                 |

---

## Architecture

```
src/
├── index.ts              # Server entry, MCP handlers, rate limiter
├── errors/               # Error hierarchy (BaseError for search layer)
├── operations/           # Business logic (one file per domain)
│   ├── filter-utils.ts   # Shared filter+sort SSOT (list + search)
│   ├── create.ts         # Atomic backup creation (copyAtomic)
│   ├── restore.ts        # Atomic restore (temp + rename)
│   ├── diff.ts           # Myers diff comparison
│   └── ...
├── search/               # Ripgrep integration
│   ├── ripgrep-executor.ts # Semaphore-limited process runner
│   ├── ripgrep-args.ts    # Argument builder
│   └── ripgrep-types.ts   # Result types
├── tools/                # MCP tool definitions (readOnly flag)
├── types/                # TypeScript interfaces (BackupMetadata, params)
├── validation/           # Regex validation
└── utils/                # Store, persistence, hashing, config, logger
    ├── concurrency.ts    # Semaphore, parallelMap, rate limiter
    ├── config.ts         # Env-var parsing with validation
    ├── fs.ts             # Atomic copy/write, path helpers
    ├── myers-diff.ts     # LCS diff algorithm (O(n*m) capped)
    └── validate.ts       # Path traversal + root restriction
```

### Key Decisions

- **Never lose metadata** — auto-save every 30s when dirty. No manual save needed
- **Integrity you can trust** — SHA-256 hash on every backup. Verify anytime, detects bit-level corruption
- **Safe restore** — `targetPath` lets you restore elsewhere instead of overwriting the live file
- **Batch without blocking** — semaphore-based concurrency (5 default). All files backed up, none skipped
- **Search inside backups** — ripgrep content search means you don't need to restore to find what's inside
- **Deduplicate to save space** — find identical backups by content hash. Safe to delete, original stays intact

---

## Development

```bash
npm run build      # Compile TypeScript
npm run watch      # Watch mode
npm run inspector  # Run MCP inspector for debugging
npm test           # Run tests (vitest)
```

## Data Format

Backups are stored in `BACKUP_DIR` with:

- **File copies**: `{originalName}.{backupId}.{iso-timestamp}.backup`
- **Metadata**: `metadata.json` (auto-saved every 30s when dirty)

---

## Security

- **Path traversal protection** — `..` sequences and `~` expansion validated before any filesystem access
- **Root restriction** — set `BACKUP_ALLOWED_ROOTS` to keep AI inside your project directories
- **Hash verification** — SHA-256 integrity check on every backup and restore
- **All paths validated before access** — no symlink tricks, no escaping roots

## Companion Project

[**Filesystem Pro**](https://github.com/lordc-dev/filesystem-pro) — give AI real developer access to your codebase. Ripgrep search, tree-sitter code understanding in 17 languages, AST-based surgical edits, and a full undo stack. Backup Pro versions your files; Filesystem Pro gives AI the tools to edit them safely.

## License

MIT — See original [MCP Servers repository](https://github.com/modelcontextprotocol/servers) for details.

## Credits

- Original: [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers)
- MCP SDK: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
