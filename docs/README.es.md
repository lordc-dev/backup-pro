# Backup Pro

[English](../README.md) | [Español](README.es.md) | [Català](README.ca.md) | [Galego](README.gl.md) | [Euskara](README.eu.md) | [Français](README.fr.md) | [Português](README.pt.md)

**Cada vez que la IA edita tu código, arriesgas perder el original.** Backup Pro soluciona eso — versiona cada archivo antes de que la IA lo toque, busca y compara respaldos al instante, restaura con un clic. Integridad SHA-256, deduplicación, operaciones por lotes. 17 herramientas. Funciona con Claude, Cursor y cualquier IA compatible con MCP.

> **Fork mejorado** del [Anthropic MCP Backup Server](https://github.com/modelcontextprotocol/servers) — versionado de archivos, etiquetas, búsqueda, comparación, verificación, deduplicación y operaciones por lotes.

_Construido y mantenido por:_

[![LinkedIn](https://img.shields.io/badge/LinkedIn-albertocastrootero-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/albertocastrootero)

---

## ¿Por qué Backup Pro?

- **¿La IA editó tu archivo y ahora está roto?** — un clic para restaurar cualquier versión anterior. Cada respaldo es un punto de retorno al que puedes volver
- **¿Necesitas ver qué cambió?** — compara cualquier respaldo con el archivo actual o con otro respaldo. Ve exactamente qué se añadió, eliminó o modificó
- **¿Editas muchos archivos a la vez?** — respaldo por lotes antes de refactorizar. Etiquetas y descripción compartidas en todos los archivos, una sola operación
- **¿Te preocupa la corrupción?** — la verificación hash SHA-256 detecta cualquier cambio a nivel de bit. Verifica después de restaurar, verifica en cualquier momento
- **¿Desperdicias espacio en duplicados?** — encuentra respaldos idénticos y recupera espacio. Deduplicación incluida

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

> Sin ripgrep, todas las herramientas funcionan excepto `search_backup_content`.

### 2. Instalar y compilar el servidor

```bash
cd /ruta/a/backup-pro
npm install
npm run build
```

## Configuración

Añade a la configuración de tu cliente MCP:

```json
{
  "mcpServers": {
    "backup-pro": {
      "command": "node",
      "args": ["/ruta/a/backup-pro/dist/index.js"],
      "env": {
        "BACKUP_ALLOWED_ROOTS": "/Users/tu/proyectos:/home/tu/codigo"
      }
    }
  }
}
```

### Variables de entorno

#### Seguridad

| Variable               | Predeterminado    | Descripción                                                                         |
| ---------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `BACKUP_ALLOWED_ROOTS` | (todas las rutas) | Mantén la IA dentro de tus directorios de proyecto. Raíces separadas por dos puntos |
| `BACKUP_DIR`           | `~/.mcp-backups`  | Dónde se almacenan los respaldos y metadatos                                        |

#### Límites

| Variable                | Predeterminado | Descripción                                                           |
| ----------------------- | -------------- | --------------------------------------------------------------------- |
| `AUTO_SAVE_INTERVAL_MS` | `30000`        | Cada cuánto se auto-guardan los metadatos (ms)                        |
| `MAX_PREVIEW_CHARS`     | `10000`        | Caracteres máximos en la vista previa — evita que el contexto explote |
| `BATCH_CONCURRENCY`     | `5`            | Copias de archivo paralelas máximas en operaciones por lotes          |

#### Depuración

| Variable    | Predeterminado | Descripción                                        |
| ----------- | -------------- | -------------------------------------------------- |
| `LOG_LEVEL` | `info`         | Nivel de detalle: `debug`, `info`, `warn`, `error` |

---

## Herramientas (17)

### Crear y restaurar

| Herramienta      | Descripción                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `create_backup`  | Respalda un archivo antes de que la IA lo toque. Añade etiquetas y descripción para contexto |
| `batch_backup`   | Respalda muchos archivos a la vez. Etiquetas compartidas, una sola operación                 |
| `restore_backup` | Restaura a cualquier versión anterior. Opcionalmente a una ruta diferente                    |

### Buscar y encontrar

| Herramienta             | Descripción                                                                       |
| ----------------------- | --------------------------------------------------------------------------------- |
| `list_backups`          | Encuentra respaldos por archivo, etiquetas, rango de fechas o término de búsqueda |
| `search_backups`        | Busca por descripción, etiquetas o nombre de archivo                              |
| `get_backup`            | Metadatos completos de un respaldo — tamaño, hash, etiquetas, marcas de tiempo    |
| `get_backup_stats`      | Resumen: cuántos respaldos, tamaño total, etiquetas principales                   |
| `search_backup_content` | Busca dentro de los archivos de respaldo con ripgrep (opcional)                   |

### Comparar y previsualizar

| Herramienta      | Descripción                                                                          |
| ---------------- | ------------------------------------------------------------------------------------ |
| `diff_backup`    | Compara un respaldo con el archivo actual — o con otro respaldo                      |
| `preview_backup` | Lee el contenido del respaldo sin restaurar. Usa `head`/`tail` para archivos grandes |

### Etiquetas

| Herramienta   | Descripción                               |
| ------------- | ----------------------------------------- |
| `add_tags`    | Categoriza un respaldo después de crearlo |
| `remove_tags` | Limpia respaldos mal etiquetados          |
| `list_tags`   | Ve todas las etiquetas en uso             |

### Mantenimiento

| Herramienta       | Descripción                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `verify_backup`   | Verifica integridad hash SHA-256 — detecta corrupción                           |
| `find_duplicates` | Encuentra respaldos con contenido idéntico — recupera espacio desperdiciado     |
| `cleanup_backups` | Elimina respaldos antiguos o excesivos. Usa `dryRun` primero para previsualizar |
| `delete_backup`   | Elimina un respaldo específico                                                  |

---

## Arquitectura

```
src/
├── index.ts              # Punto de entrada del servidor, manejadores MCP
├── operations/           # Lógica de negocio (un archivo por dominio)
├── tools/                # Definiciones de herramientas MCP
└── utils/                # Almacenamiento, persistencia, hashing, configuración, logger
```

### Decisiones clave

- **Nunca pierdas metadatos** — auto-guardado cada 30s cuando hay cambios. No necesitas guardar manualmente
- **Integridad en la que puedes confiar** — hash SHA-256 en cada respaldo. Verifica en cualquier momento, detecta corrupción a nivel de bit
- **Restauración segura** — `targetPath` te permite restaurar en otra ubicación en vez de sobreescribir el archivo en vivo
- **Lotes sin bloquear** — concurrencia basada en semáforos (5 por defecto). Todos los archivos respaldados, ninguno omitido
- **Búsqueda dentro de respaldos** — la búsqueda de contenido con ripgrep significa que no necesitas restaurar para encontrar qué hay dentro
- **Deduplica para ahorrar espacio** — encuentra respaldos idénticos por hash de contenido. Seguro de eliminar, el original permanece intacto

---

## Desarrollo

```bash
npm run build      # Compilar TypeScript
npm run watch      # Modo watch
npm run inspector  # Ejecutar inspector MCP para depuración
npm test           # Ejecutar tests (vitest)
```

## Formato de datos

Los respaldos se almacenan en `BACKUP_DIR` con:

- **Copias de archivo**: `{originalName}.{backupId}.{iso-timestamp}.backup`
- **Metadatos**: `metadata.json` (auto-guardado cada 30s cuando hay cambios)

---

## Seguridad

- **Protección contra path traversal** — las secuencias `..` y la expansión de `~` se validan antes de cualquier acceso al sistema de archivos
- **Restricción de raíz** — configura `BACKUP_ALLOWED_ROOTS` para mantener la IA dentro de tus directorios de proyecto
- **Verificación hash** — comprobación de integridad SHA-256 en cada respaldo y restauración
- **Todas las rutas validadas antes del acceso** — sin trucos de symlinks, sin escapar de las raíces

## Proyecto complementario

[**Filesystem Pro**](https://github.com/lordc-dev/filesystem-pro) — da a la IA acceso real de desarrollador a tu código. Búsqueda ripgrep, comprensión de código con tree-sitter en 17 lenguajes, ediciones quirúrgicas basadas en AST y una pila de deshacer completa. Backup Pro versiona tus archivos; Filesystem Pro da a la IA las herramientas para editarlos con seguridad.

## Licencia

MIT — Consulta el [repositorio original de MCP Servers](https://github.com/modelcontextprotocol/servers) para más detalles.

## Créditos

- Original: [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers)
- MCP SDK: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
