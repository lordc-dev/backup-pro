# Backup Pro

[English](../README.md) | [Español](README.es.md) | [Català](README.ca.md) | [Galego](README.gl.md) | [Euskara](README.eu.md) | [Français](README.fr.md) | [Português](README.pt.md)

**Cada vegada que la IA edita el teu codi, corres el risc de perdre l'original.** Backup Pro soluciona això — versiona cada fitxer abans que la IA el toqui, cerca i compara còpies de seguretat a l'instant, restaura amb un clic. Integritat SHA-256, deduplicació, operacions per lots. 17 eines. Funciona amb Claude, Cursor i qualsevol IA compatible amb MCP.

> **Fork millorat** de l'[Anthropic MCP Backup Server](https://github.com/modelcontextprotocol/servers) — versionat de fitxers, etiquetes, cerca, diff, verificació, deduplicació i operacions per lots.

_Construït i mantingut per:_

[![LinkedIn](https://img.shields.io/badge/LinkedIn-albertocastrootero-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/albertocastrootero)

---

## Per què Backup Pro?

- **La IA ha editat el teu fitxer i ara està trencat?** — un clic per restaurar qualsevol versió anterior. Cada còpia de seguretat és un punt de restauració on pots tornar
- **Necessites saber què ha canviat?** — compara qualsevol còpia amb el fitxer actual o amb una altra còpia. Veure exactament què s'ha afegit, eliminat o modificat
- **Edites molts fitxers alhora?** — còpia de seguretat per lots abans de refactoritzar. Etiquetes i descripció compartides entre tots els fitxers, una sola operació
- **Et preocupa la corrupció?** — la verificació de hash SHA-256 detecta qualsevol canvi a nivell de bit. Verifica després de restaurar, verifica en qualsevol moment
- **Desaprofita espai en disc amb duplicats?** — troba còpies de seguretat idèntiques i recupera espai. Deduplicació integrada

---

## Instal·lació

### 1. Instal·la ripgrep (opcional — per a `search_backup_content`)

| Plataforma           | Ordre                                    |
| -------------------- | ---------------------------------------- |
| **macOS**            | `brew install ripgrep`                   |
| **Debian/Ubuntu**    | `sudo apt install ripgrep`               |
| **Fedora**           | `sudo dnf install ripgrep`               |
| **Arch**             | `sudo pacman -S ripgrep`                 |
| **Windows (winget)** | `winget install BurntSushi.ripgrep.MSVC` |
| **Windows (scoop)**  | `scoop install ripgrep`                  |
| **Windows (choco)**  | `choco install ripgrep`                  |

> Sense ripgrep, totes les eines funcionen excepte `search_backup_content`.

### 2. Instal·la i compila el servidor

```bash
cd /path/to/backup-pro
npm install
npm run build
```

## Configuració

Afegeix a la configuració del teu client MCP (sense bloc `env` — el servidor llegeix les variables d'un fitxer `.env` al seu propi directori mitjançant dotenv):

```json
{
  "mcpServers": {
    "backup-pro": {
      "command": "node",
      "args": ["/path/to/backup-pro/dist/index.js"]
    }
  }
}
```

### Variables d'entorn

Copia `.env.example` a `.env` a l'arrel del projecte i ajusta els valors:

```bash
cp .env.example .env
```

El servidor carrega `.env` automàticament a l'inici. No posis variables d'entorn a la configuració del client MCP — mantén-les a `.env` perquè s'apliquin els valors per defecte i la validació del servidor.

#### Seguretat

| Variable               | Per defecte       | Descripció                                                                    |
| ---------------------- | ----------------- | ----------------------------------------------------------------------------- |
| `BACKUP_ALLOWED_ROOTS` | (tots els camins) | Manté la IA dins dels directoris del teu projecte. Arrels separades per comes |
| `BACKUP_DIR`           | `~/.mcp-backups`  | On s'emmagatzemen les còpies de seguretat i les metadades                     |

#### Límits

| Variable                | Per defecte | Descripció                                                                  |
| ----------------------- | ----------- | ---------------------------------------------------------------------------- |
| `AUTO_SAVE_INTERVAL_MS` | `30000`     | Amb quina freqüència les metadades es desen automàticament (ms)              |
| `MAX_PREVIEW_CHARS`     | `10000`     | Màxim de caràcters a la vista prèvia — evita que el context exploti          |
| `BATCH_CONCURRENCY`     | `5`         | Màxim de còpies de fitxers en paral·lel en operacions per lots (mín: 1)      |
| `MAX_BACKUPS_PER_FILE`  | `0`            | Còpies de seguretat màximes per fitxer abans d'avisar de neteja (0 = il·limitat) |
| `MAX_FILE_SIZE`         | `104857600`    | Mida màxima de fitxer per a operacions de còpia de seguretat (100 MB per defecte) |
| `MAX_DIFF_SIZE`         | `10485760`     | Mida màxima de fitxer per a operacions de diff (10 MB per defecte)            |
| `MAX_HASH_SIZE`         | `104857600`    | Mida màxima de fitxer per a hash en get/verify (100 MB per defecte)           |

#### Cerca (ripgrep)

| Variable               | Per defecte | Descripció                                              |
| ---------------------- | ----------- | ------------------------------------------------------- |
| `MCP_MAX_CONCURRENT_RG`| `8`            | Màxim de processos ripgrep en paral·lel (mín: 1)         |
| `MCP_RG_TIMEOUT_MS`    | `30000`        | Temps d'espera del procés ripgrep en ms (mín: 1000)      |

#### Depuració

| Variable    | Per defecte | Descripció                                   |
| ----------- | ----------- | -------------------------------------------- |
| `LOG_LEVEL` | `info`      | Verbositat: `debug`, `info`, `warn`, `error` |

---

## Eines (17)

### Creació i restauració

| Eina             | Descripció                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `create_backup`  | Fes una còpia de seguretat d'un fitxer abans que la IA el toqui. Afegeix etiquetes i descripció per al context |
| `batch_backup`   | Fes còpia de molts fitxers alhora. Etiquetes compartides, una sola operació                                    |
| `restore_backup` | Restaura qualsevol versió anterior. Opcionalment a un camí diferent                                            |

### Cerca i exploració

| Eina                    | Descripció                                                                 |
| ----------------------- | -------------------------------------------------------------------------- |
| `list_backups`          | Troba còpies per fitxer, etiquetes, rang de dates o terme de cerca         |
| `search_backups`        | Cerca per descripció, etiquetes o nom de fitxer                            |
| `get_backup`            | Metadades completes d'una còpia — mida, hash, etiquetes, marques temporals |
| `get_backup_stats`      | Resum: quantes còpies, mida total, etiquetes més freqüents                 |
| `search_backup_content` | Cerca dins dels fitxers de còpia amb ripgrep (opcional)                    |

### Comparació i vista prèvia

| Eina             | Descripció                                                                              |
| ---------------- | --------------------------------------------------------------------------------------- |
| `diff_backup`    | Compara una còpia amb el fitxer actual — o amb una altra còpia                          |
| `preview_backup` | Llegeix el contingut de la còpia sense restaurar. Usa `head`/`tail` per a fitxers grans |

### Etiquetes

| Eina          | Descripció                                |
| ------------- | ----------------------------------------- |
| `add_tags`    | Categoritza una còpia després de crear-la |
| `remove_tags` | Neteja còpies mal etiquetades             |
| `list_tags`   | Veure totes les etiquetes en ús           |

### Manteniment

| Eina              | Descripció                                                                   |
| ----------------- | ---------------------------------------------------------------------------- |
| `verify_backup`   | Comprova la integritat del hash SHA-256 — detecta corrupció                  |
| `find_duplicates` | Troba còpies amb contingut idèntic — recupera espai malgastat                |
| `cleanup_backups` | Elimina còpies antigues o excessives. Usa `dryRun` primer per previsualitzar |
| `delete_backup`   | Elimina una còpia específica                                                 |

---

## Arquitectura

```
src/
├── index.ts              # Entrada del servidor, gestors MCP, limitador de freqüència
├── errors/               # Jerarquia d'errors (BaseError per a capa de cerca)
├── operations/           # Lògica de negoci (un fitxer per domini)
│   ├── filter-utils.ts   # SSOT compartit de filtre+ordenació (list + search)
│   ├── create.ts         # Creació atòmica de còpies de seguretat (copyAtomic)
│   ├── restore.ts        # Restauració atòmica (temp + rename)
│   ├── diff.ts           # Comparació Myers diff
│   └── ...
├── search/               # Integració ripgrep
│   ├── ripgrep-executor.ts # Executor de processos limitat per semàfor
│   ├── ripgrep-args.ts    # Constructor d'arguments
│   └── ripgrep-types.ts   # Tipus de resultat
├── tools/                # Definicions d'eines MCP (flag readOnly)
├── types/                # Interfícies TypeScript (BackupMetadata, paràmetres)
├── validation/           # Validació amb regex
└── utils/                # Emmagatzematge, persistència, hashing, configuració, registre
    ├── concurrency.ts    # Semàfor, parallelMap, limitador de freqüència
    ├── config.ts         # Anàlisi de variables d'entorn amb validació
    ├── fs.ts             # Còpia/escriptura atòmica, helpers de rutes
    ├── myers-diff.ts     # Algoritme LCS diff (O(n*m) limitat)
    └── validate.ts       # Path traversal + restricció d'arrels
```

### Decisions clau

- **Mai perds metadades** — desat automàticament cada 30s si hi ha canvis. No cal desat manual
- **Integritat en la que pots confiar** — hash SHA-256 per cada còpia. Verifica en qualsevol moment, detecta corrupció a nivell de bit
- **Restauració segura** — `targetPath` et permet restaurar en un altre lloc en lloc de sobreescriure el fitxer actiu
- **Lots sense bloquejar** — concurrència basada en semàfor (5 per defecte). Tots els fitxers amb còpia, cap omès
- **Cerca dins de les còpies** — la cerca de contingut amb ripgrep permet trobar què hi ha dins sense haver de restaurar
- **Deduplica per estalviar espai** — troba còpies idèntiques per hash de contingut. Segur d'eliminar, l'original es manté intacte

---

## Desenvolupament

```bash
npm run build      # Compilar TypeScript
npm run watch      # Mode vigilància
npm run inspector  # Executar l'inspector MCP per a depuració
npm test           # Executar tests (vitest)
```

## Format de dades

Les còpies de seguretat s'emmagatzemen a `BACKUP_DIR` amb:

- **Còpies de fitxers**: `{originalName}.{backupId}.{iso-timestamp}.backup`
- **Metadades**: `metadata.json` (desat automàticament cada 30s si hi ha canvis)

---

## Seguretat

- **Protecció contra path traversal** — les seqüències `..` i l'expansió de `~` es validen abans de qualsevol accés al sistema de fitxers
- **Restricció d'arrels** — configura `BACKUP_ALLOWED_ROOTS` per mantenir la IA dins dels directoris del teu projecte
- **Verificació de hash** — comprovació d'integritat SHA-256 per cada còpia i restauració
- **Tots els camins validats abans de l'accés** — sense trucs amb symlinks, sense escapar de les arrels

## Projecte complementari

[**Filesystem Pro**](https://github.com/lordc-dev/filesystem-pro) — dóna a la IA accés real de desenvolupador al teu codi. Cerca ripgrep, comprensió de codi amb tree-sitter en 17 llengües, edicions quirúrgiques basades en AST i una pila de desfer completa. Backup Pro versiona els teus fitxers; Filesystem Pro dóna a la IA les eines per editar-los amb seguretat.

## Llicència

MIT — Consulta el [repositori original de MCP Servers](https://github.com/modelcontextprotocol/servers) per a més detalls.

## Crèdits

- Original: [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers)
- MCP SDK: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
