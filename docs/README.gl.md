# Backup Pro

[English](../README.md) | [Español](README.es.md) | [Català](README.ca.md) | [Galego](README.gl.md) | [Euskara](README.eu.md) | [Français](README.fr.md) | [Português](README.pt.md)

**Cada vez que a IA edita o teu código, arriscas perder o orixinal.** Backup Pro soluciona isto — versiona cada ficheiro antes de que a IA o toque, busca e compara copias de seguranza ao instante, e restáuraas cun clic. Integridade SHA-256, desduplicación, operacións por lotes. 17 ferramentas. Funciona con Claude, Cursor e calquera IA compatible con MCP.

> **Fork mellorado** do [Anthropic MCP Backup Server](https://github.com/modelcontextprotocol/servers) — versionado de ficheiros, etiquetas, busca, diff, verificación, desduplicación e operacións por lotes.

_Construído e mantido por:_

[![LinkedIn](https://img.shields.io/badge/LinkedIn-albertocastrootero-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/albertocastrootero)

---

## Por que Backup Pro?

- **A IA editou o teu ficheiro e agora está roto?** — un clic para restaurar calquera versión anterior. Cada copia de seguranza é un punto de retorno
- **Precisas saber que cambiou?** — compara calquera copia de seguranza co ficheiro actual ou con outra copia. Ve exactamente que se engadiu, eliminou ou modificou
- **Estás a editar moitos ficheiros á vez?** — copia de seguranza por lotes antes de refactorizar. Etiquetas e descrición compartidas en todos os ficheiros, nunha soa operación
- **Preocupache a corrupción de datos?** — a verificación hash SHA-256 detecta calquera cambio a nivel de bit. Verifica despois de restaurar, verifica en calquera momento
- **Desperdiciando espazo en disco con duplicados?** — atopa copias de seguranza idénticas e recupera espazo. Desduplicación integrada

---

## Instalación

### 1. Instalar ripgrep (opcional — para `search_backup_content`)

| Plataforma           | Comando                                  |
| -------------------- | ---------------------------------------- |
| **macOS**            | `brew install ripgrep`                   |
| **Debian/Ubuntu**    | `sudo apt install ripgrep`               |
| **Fedora**           | `sudo dnf install ripgrep`               |
| **Arch**             | `sudo pacman -S ripgrep`                 |
| **Windows (winget)** | `winget install BurntSushi.ripgrep.MSVC` |
| **Windows (scoop)**  | `scoop install ripgrep`                  |
| **Windows (choco)**  | `choco install ripgrep`                  |

> Sen ripgrep, todas as ferramentas funcionan excepto `search_backup_content`.

### 2. Instalar e compilar o servidor

```bash
cd /path/to/backup-pro
npm install
npm run build
```

## Configuración

Engade á configuración do teu cliente MCP (sen bloque `env` — o servidor le as variables dun ficheiro `.env` no seu propio directorio mediante dotenv):

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

### Variables de contorno

Copia `.env.example` a `.env` na raíz do proxecto e axusta os valores:

```bash
cp .env.example .env
```

O servidor carga `.env` automaticamente ao iniciar. Non poñas variables de contorno na configuración do cliente MCP — mantéñas en `.env` para que se apliquen os valores por defecto e a validación do servidor.

#### Seguranza

| Variable               | Predeterminado   | Descrición                                                                           |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `BACKUP_ALLOWED_ROOTS` | (todas as rutas) | Mantén a IA dentro dos directorios do teu proxecto. Raíces separadas por dous puntos |
| `BACKUP_DIR`           | `~/.mcp-backups` | Onde se almacenan as copias de seguranza e os metadatos                              |

#### Límites

| Variable                | Predeterminado | Descrición                                                                  |
| ----------------------- | -------------- | ---------------------------------------------------------------------------- |
| `AUTO_SAVE_INTERVAL_MS` | `30000`        | Con que frecuencia se gardan automaticamente os metadatos (ms)               |
| `MAX_PREVIEW_CHARS`     | `10000`        | Caracteres máximos na vista previa — evita que o contexto creza desmesuradamente |
| `BATCH_CONCURRENCY`     | `5`            | Copias de ficheiro paralelas máximas en operacións por lotes (mín: 1)        |
| `MAX_BACKUPS_PER_FILE`  | `0`            | Respaldos máximos por ficheiro antes de avisar de limpeza (0 = ilimitado)    |
| `MAX_FILE_SIZE`         | `104857600`    | Tamaño máximo de ficheiro para operacións de respaldo (100 MB por defecto)   |
| `MAX_DIFF_SIZE`         | `10485760`     | Tamaño máximo de ficheiro para operacións de diff (10 MB por defecto)        |
| `MAX_HASH_SIZE`         | `104857600`    | Tamaño máximo de ficheiro para hash en get/verify (100 MB por defecto)       |

#### Busca (ripgrep)

| Variable               | Predeterminado | Descrición                                              |
| ---------------------- | -------------- | ------------------------------------------------------- |
| `MCP_MAX_CONCURRENT_RG`| `8`            | Procesos ripgrep paralelos máximos (mín: 1)             |
| `MCP_RG_TIMEOUT_MS`    | `30000`        | Tempo de espera do proceso ripgrep en ms (mín: 1000)    |

#### Depuración

| Variable    | Predeterminado | Descrición                                    |
| ----------- | -------------- | --------------------------------------------- |
| `LOG_LEVEL` | `info`         | Verbosidade: `debug`, `info`, `warn`, `error` |

---

## Ferramentas (17)

### Creación e restauración

| Ferramenta       | Descrición                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `create_backup`  | Fai unha copia de seguranza antes de que a IA toque o ficheiro. Engade etiquetas e descrición para contexto |
| `batch_backup`   | Fai unha copia de seguranza de moitos ficheiros á vez. Etiquetas compartidas, unha soa operación            |
| `restore_backup` | Restaura a calquera versión anterior. Opcionalmente a unha ruta diferente                                   |

### Busca e procura

| Ferramenta              | Descrición                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `list_backups`          | Atopa copias de seguranza por ficheiro, etiquetas, intervalo de datas ou termo de busca |
| `search_backups`        | Busca por descrición, etiquetas ou nome de ficheiro                                     |
| `get_backup`            | Metadatos completos dunha copia de seguranza — tamaño, hash, etiquetas, marcas de tempo |
| `get_backup_stats`      | Vista xeral: cantas copias de seguranza, tamaño total, etiquetas máis usadas            |
| `search_backup_content` | Busca dentro dos ficheiros de copia de seguranza con ripgrep (opcional)                 |

### Comparación e vista previa

| Ferramenta       | Descrición                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `diff_backup`    | Compara unha copia de seguranza co ficheiro actual — ou con outra copia de seguranza       |
| `preview_backup` | Le o contido da copia de seguranza sen restaurar. Usa `head`/`tail` para ficheiros grandes |

### Etiquetas

| Ferramenta    | Descrición                                           |
| ------------- | ---------------------------------------------------- |
| `add_tags`    | Categoriza unha copia de seguranza despois de creala |
| `remove_tags` | Limpa copias de seguranza mal etiquetadas            |
| `list_tags`   | Mira todas as etiquetas en uso                       |

## Mantemento

| Ferramenta        | Descrición                                                                            |
| ----------------- | ------------------------------------------------------------------------------------- |
| `verify_backup`   | Comproba a integridade do hash SHA-256 — detecta corrupción                           |
| `find_duplicates` | Atopa copias de seguranza con contido idéntico — recupera espazo desperdiciado        |
| `cleanup_backups` | Poda copias de seguranza vellas ou excesivas. Usa `dryRun` primeiro para vista previa |
| `delete_backup`   | Elimina unha copia de seguranza específica                                            |

---

## Arquitectura

```
src/
├── index.ts              # Entrada do servidor, xestores MCP, limitador de frecuencia
├── errors/               # Xerarquía de erros (BaseError para capa de busca)
├── operations/           # Lóxica de negocio (un ficheiro por dominio)
│   ├── filter-utils.ts   # SSOT compartido de filtro+orde (list + search)
│   ├── create.ts         # Creación atómica de respaldos (copyAtomic)
│   ├── restore.ts        # Restauración atómica (temp + rename)
│   ├── diff.ts           # Comparación Myers diff
│   └── ...
├── search/               # Integración ripgrep
│   ├── ripgrep-executor.ts # Executor de procesos limitado por semáforo
│   ├── ripgrep-args.ts    # Constructor de argumentos
│   └── ripgrep-types.ts   # Tipos de resultado
├── tools/                # Definicións de ferramentas MCP (flag readOnly)
├── types/                # Interfaces TypeScript (BackupMetadata, parámetros)
├── validation/           # Validación con regex
└── utils/                # Almacén, persistencia, hashing, config, logger
    ├── concurrency.ts    # Semáforo, parallelMap, limitador de frecuencia
    ├── config.ts         # Análise de variables de contorno con validación
    ├── fs.ts             # Copia/escritura atómica, helpers de rutas
    ├── myers-diff.ts     # Algoritmo LCS diff (O(n*m) limitado)
    └── validate.ts       # Path traversal + restrición de raíces
```

### Decisións clave

- **Non perder nunca metadatos** — gardado automático cada 30 s se hai cambios. Non fai falla gardado manual
- **Integridade na que podes confiar** — hash SHA-256 en cada copia de seguranza. Verifica en calquera momento, detecta corrupción a nivel de bit
- **Restauración segura** — `targetPath` permíteche restaurar noutro lugar en vez de sobrescribir o ficheiro en uso
- **Lotes sen bloqueo** — concorrencia baseada en semáforo (5 por defecto). Todos os ficheiros copiados, ningún omitido
- **Busca dentro das copias de seguranza** — a busca de contido con ripgrep permite atopar que hai dentro sen restaurar
- **Desduplica para aforrar espazo** — atopa copias de seguranza idénticas polo hash de contido. Seguro de eliminar, o orixinal mantense intacto

---

## Desenvolvemento

```bash
npm run build      # Compilar TypeScript
npm run watch      # Modo vixilante
npm run inspector  # Executar o inspector MCP para depuración
npm test           # Executar as probas (vitest)
```

## Formato de datos

As copias de seguranza almacénanse en `BACKUP_DIR` con:

- **Copias de ficheiro**: `{originalName}.{backupId}.{iso-timestamp}.backup`
- **Metadatos**: `metadata.json` (gardado automaticamente cada 30 s se hai cambios)

---

## Seguranza

- **Protección contra path traversal** — as secuencias `..` e a expansión de `~` son validadas antes de calquera acceso ao sistema de ficheiros
- **Restrición de raíces** — establece `BACKUP_ALLOWED_ROOTS` para manter a IA dentro dos directorios do teu proxecto
- **Verificación hash** — comprobación de integridade SHA-256 en cada copia de seguranza e restauración
- **Todas as rutas validadas antes do acceso** — sen trucos con symlinks, sen escapar das raíces

## Proxecto complementario

[**Filesystem Pro**](https://github.com/lordc-dev/filesystem-pro) — dálle á IA acceso real de desenvolvedor ao teu código. Busca ripgrep, comprensión de código con tree-sitter en 17 linguaxes, edicións cirúrxicas baseadas en AST e unha pila de desfacer completa. Backup Pro versiona os teus ficheiros; Filesystem Pro dálle á IA as ferramentas para editalos con seguranza.

## Licenza

MIT — Consulta o [repositorio orixinal de MCP Servers](https://github.com/modelcontextprotocol/servers) para máis detalles.

## Créditos

- Orixinal: [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers)
- MCP SDK: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
