# Backup Pro

[English](../README.md) | [Español](README.es.md) | [Català](README.ca.md) | [Galego](README.gl.md) | [Euskara](README.eu.md) | [Français](README.fr.md) | [Português](README.pt.md)

**Chaque fois que l'IA modifie votre code, vous risquez de perdre l'original.** Backup Pro résout ce problème — versionnez chaque fichier avant que l'IA n'y touche, recherchez et comparez les sauvegardes instantanément, restaurez en un clic. Intégrité SHA-256, déduplication, opérations par lot. 17 outils. Fonctionne avec Claude, Cursor et toute IA compatible MCP.

> **Fork amélioré** du [serveur de sauvegarde MCP d'Anthropic](https://github.com/modelcontextprotocol/servers) — versionnage de fichiers, tags, recherche, comparaison, vérification, déduplication et opérations par lot.

_Conçu et maintenu par :_

[![LinkedIn](https://img.shields.io/badge/LinkedIn-albertocastrootero-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/albertocastrootero)

---

## Pourquoi Backup Pro ?

- **L'IA a modifié votre fichier et il est cassé ?** — un clic pour restaurer n'importe quelle version précédente. Chaque sauvegarde est un point de restauration auquel vous pouvez revenir
- **Besoin de voir ce qui a changé ?** — comparez n'importe quelle sauvegarde avec le fichier actuel ou une autre sauvegarde. Voyez exactement ce qui a été ajouté, supprimé ou modifié
- **Vous éditez plusieurs fichiers à la fois ?** — sauvegardez par lot avant un refactorage. Tags et description partagés pour tous les fichiers, en une seule opération
- **Vous craignez la corruption ?** — la vérification par hachage SHA-256 détecte toute modification au niveau du bit. Vérifiez après restauration, vérifiez à tout moment
- **Vous perdez de l'espace disque avec des doublons ?** — trouvez les sauvegardes identiques et récupérez de l'espace. Déduplication intégrée

---

## Installation

### 1. Installer ripgrep (facultatif — pour `search_backup_content`)

| Plateforme           | Commande                                 |
| -------------------- | ---------------------------------------- |
| **macOS**            | `brew install ripgrep`                   |
| **Debian/Ubuntu**    | `sudo apt install ripgrep`               |
| **Fedora**           | `sudo dnf install ripgrep`               |
| **Arch**             | `sudo pacman -S ripgrep`                 |
| **Windows (winget)** | `winget install BurntSushi.ripgrep.MSVC` |
| **Windows (scoop)**  | `scoop install ripgrep`                  |
| **Windows (choco)**  | `choco install ripgrep`                  |

> Sans ripgrep, tous les outils fonctionnent sauf `search_backup_content`.

### 2. Installer et compiler le serveur

```bash
cd /path/to/backup-pro
npm install
npm run build
```

## Configuration

Ajoutez à la configuration de votre client MCP :

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

### Variables d'environnement

#### Sécurité

| Variable               | Par défaut         | Description                                                            |
| ---------------------- | ------------------ | ---------------------------------------------------------------------- |
| `BACKUP_ALLOWED_ROOTS` | (tous les chemins) | Confiner l'IA dans vos répertoires de projet. Racines séparées par `:` |
| `BACKUP_DIR`           | `~/.mcp-backups`   | Emplacement de stockage des sauvegardes et des métadonnées             |

#### Limites

| Variable                | Par défaut | Description                                                   |
| ----------------------- | ---------- | ------------------------------------------------------------- |
| `AUTO_SAVE_INTERVAL_MS` | `30000`    | Fréquence de sauvegarde automatique des métadonnées (ms)      |
| `MAX_PREVIEW_CHARS`     | `10000`    | Caractères max dans l'aperçu — évite l'explosion du contexte  |
| `BATCH_CONCURRENCY`     | `5`        | Copies de fichiers parallèles max dans les opérations par lot |

#### Débogage

| Variable    | Par défaut | Description                                  |
| ----------- | ---------- | -------------------------------------------- |
| `LOG_LEVEL` | `info`     | Verbosité : `debug`, `info`, `warn`, `error` |

---

## Outils (17)

### Création et restauration

| Outil            | Description                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `create_backup`  | Sauvegarder un fichier avant que l'IA ne le modifie. Ajouter des tags et une description pour le contexte |
| `batch_backup`   | Sauvegarder plusieurs fichiers à la fois. Tags partagés, une seule opération                              |
| `restore_backup` | Restaurer n'importe quelle version précédente. Optionnellement vers un autre chemin                       |

### Recherche et filtrage

| Outil                   | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| `list_backups`          | Trouver des sauvegardes par fichier, tags, plage de dates ou terme de recherche |
| `search_backups`        | Rechercher par description, tags ou nom de fichier                              |
| `get_backup`            | Métadonnées complètes d'une sauvegarde — taille, hachage, tags, horodatages     |
| `get_backup_stats`      | Vue d'ensemble : nombre de sauvegardes, taille totale, tags les plus utilisés   |
| `search_backup_content` | Rechercher dans le contenu des sauvegardes avec ripgrep (facultatif)            |

### Comparaison et aperçu

| Outil            | Description                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `diff_backup`    | Comparer une sauvegarde avec le fichier actuel — ou avec une autre sauvegarde                  |
| `preview_backup` | Lire le contenu d'une sauvegarde sans restaurer. Utiliser `head`/`tail` pour les gros fichiers |

### Tags

| Outil         | Description                                  |
| ------------- | -------------------------------------------- |
| `add_tags`    | Catégoriser une sauvegarde après sa création |
| `remove_tags` | Nettoyer les sauvegardes mal étiquetées      |
| `list_tags`   | Voir tous les tags utilisés                  |

### Maintenance

| Outil             | Description                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `verify_backup`   | Vérifier l'intégrité du hachage SHA-256 — détecter la corruption                               |
| `find_duplicates` | Trouver les sauvegardes au contenu identique — récupérer l'espace gaspillé                     |
| `cleanup_backups` | Éliminer les sauvegardes anciennes ou excessives. Utiliser `dryRun` d'abord pour prévisualiser |
| `delete_backup`   | Supprimer une sauvegarde spécifique                                                            |

---

## Architecture

```
src/
├── index.ts              # Point d'entrée du serveur, gestionnaires MCP
├── operations/           # Logique métier (un fichier par domaine)
├── tools/                # Définitions des outils MCP
└── utils/                # Stockage, persistance, hachage, configuration, journalisation
```

### Décisions clés

- **Ne jamais perdre les métadonnées** — sauvegarde automatique toutes les 30s si modifiées. Pas besoin de sauvegarde manuelle
- **Une intégrité fiable** — hachage SHA-256 sur chaque sauvegarde. Vérifiez à tout moment, détecte la corruption au niveau du bit
- **Restauration sécurisée** — `targetPath` permet de restaurer ailleurs au lieu d'écraser le fichier en place
- **Opérations par lot sans blocage** — concurrence basée sur sémaphore (5 par défaut). Tous les fichiers sauvegardés, aucun ignoré
- **Recherche dans les sauvegardes** — la recherche de contenu avec ripgrep évite de restaurer pour trouver ce qui se trouve à l'intérieur
- **Dédupliquer pour économiser de l'espace** — trouver les sauvegardes identiques par hachage de contenu. Suppression sécurisée, l'original reste intact

---

## Développement

```bash
npm run build      # Compiler TypeScript
npm run watch      # Mode surveillance
npm run inspector  # Lancer l'inspecteur MCP pour le débogage
npm test           # Exécuter les tests (vitest)
```

## Format des données

Les sauvegardes sont stockées dans `BACKUP_DIR` avec :

- **Copies de fichiers** : `{originalName}.{backupId}.{iso-timestamp}.backup`
- **Métadonnées** : `metadata.json` (sauvegarde automatique toutes les 30s si modifiées)

---

## Sécurité

- **Protection contre le parcours de répertoire** — les séquences `..` et l'expansion de `~` sont validées avant tout accès au système de fichiers
- **Restriction des racines** — définissez `BACKUP_ALLOWED_ROOTS` pour confiner l'IA dans vos répertoires de projet
- **Vérification par hachage** — contrôle d'intégrité SHA-256 sur chaque sauvegarde et restauration
- **Tous les chemins validés avant l'accès** — pas de manipulation par liens symboliques, pas de sortie des racines autorisées

## Projet complémentaire

[**Filesystem Pro**](https://github.com/lordc-dev/filesystem-pro) — donne à l'IA un accès développeur réel à votre codebase. Recherche ripgrep, compréhension du code avec tree-sitter en 17 langages, éditions chirurgicales basées sur l'AST et une pile d'annulation complète. Backup Pro versionne vos fichiers ; Filesystem Pro donne à l'IA les outils pour les éditer en toute sécurité.

## Licence

MIT — Consultez le [dépôt original MCP Servers](https://github.com/modelcontextprotocol/servers) pour plus de détails.

## Crédits

- Original : [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers)
- MCP SDK : [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
