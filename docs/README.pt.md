# Backup Pro

[English](../README.md) | [Español](README.es.md) | [Català](README.ca.md) | [Galego](README.gl.md) | [Euskara](README.eu.md) | [Français](README.fr.md) | [Português](README.pt.md)

**Sempre que a IA edita o teu código, corres o risco de perder o original.** O Backup Pro resolve isso — cria uma versão de cada ficheiro antes que a IA o toque, pesquisa e compara backups instantaneamente, restaura com um clique. Integridade SHA-256, deduplicação, operações em lote. 17 ferramentas. Funciona com Claude, Cursor e qualquer IA compatível com MCP.

> **Fork melhorado** do [Anthropic MCP Backup Server](https://github.com/modelcontextprotocol/servers) — versionamento de ficheiros, etiquetas, pesquisa, diff, verificação, deduplicação e operações em lote.

_Criado e mantido por:_

[![LinkedIn](https://img.shields.io/badge/LinkedIn-albertocastrootero-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/albertocastrootero)

---

## Porquê o Backup Pro?

- **A IA editou o teu ficheiro e agora está partido?** — um clique para restaurar qualquer versão anterior. Cada backup é um ponto de restauro para onde podes voltar
- **Precisas de saber o que mudou?** — compara qualquer backup com o ficheiro atual ou com outro backup. Vê exatamente o que foi adicionado, removido ou alterado
- **Estás a editar muitos ficheiros ao mesmo tempo?** — backup em lote antes de refatorizar. Etiquetas e descrição partilhadas em todos os ficheiros, numa só operação
- **Preocupado com corrupção?** — verificação de hash SHA-256 deteta qualquer alteração ao nível do bit. Verifica após o restauro, verifica quando quiseres
- **A desperdiçar espaço em disco com duplicados?** — encontra backups idênticos e recupera espaço. Deduplicação incluída

---

## Instalação

### 1. Instalar ripgrep (opcional — para `search_backup_content`)

| Plataforma           | Comando                                  |
| -------------------- | ---------------------------------------- |
| **macOS**            | `brew install ripgrep`                   |
| **Debian/Ubuntu**    | `sudo apt install ripgrep`               |
| **Fedora**           | `sudo dnf install ripgrep`               |
| **Arch**             | `sudo pacman -S ripgrep`                 |
| **Windows (winget)** | `winget install BurntSushi.ripgrep.MSVC` |
| **Windows (scoop)**  | `scoop install ripgrep`                  |
| **Windows (choco)**  | `scoop install ripgrep`                  |

> Sem ripgrep, todas as ferramentas funcionam exceto `search_backup_content`.

### 2. Instalar e compilar o servidor

```bash
cd /path/to/backup-pro
npm install
npm run build
```

## Configuração

Adiciona à configuração do teu cliente MCP:

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

### Variáveis de Ambiente

#### Segurança

| Variável               | Predefinição        | Descrição                                                                                      |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `BACKUP_ALLOWED_ROOTS` | (todos os caminhos) | Mantém a IA dentro dos directórios do teu projeto. Raízes separadas por vírgula de dois pontos |
| `BACKUP_DIR`           | `~/.mcp-backups`    | Onde são guardados os backups e metadados                                                      |

#### Limites

| Variável                | Predefinição | Descrição                                                                  |
| ----------------------- | ------------ | ---------------------------------------------------------------------------- |
| `AUTO_SAVE_INTERVAL_MS` | `30000`      | Frequência de auto-guarda dos metadados (ms)                              |
| `MAX_PREVIEW_CHARS`     | `10000`      | Máximo de caracteres na pré-visualização — evita explosão de contexto |
| `BATCH_CONCURRENCY`     | `5`          | Máximo de cópias de ficheiros em paralelo em operações em lote (mín: 1)   |
| `MAX_BACKUPS_PER_FILE`  | `0`            | Backups máximos por ficheiro antes de avisar de limpeza (0 = ilimitado)    |
| `MAX_FILE_SIZE`         | `104857600`    | Tamanho máximo de ficheiro para operações de backup (100 MB por defeito)   |
| `MAX_DIFF_SIZE`         | `10485760`     | Tamanho máximo de ficheiro para operações de diff (10 MB por defeito)      |
| `MAX_HASH_SIZE`         | `104857600`    | Tamanho máximo de ficheiro para hash em get/verify (100 MB por defeito)     |

#### Pesquisa (ripgrep)

| Variável               | Predefinição | Descrição                                              |
| ---------------------- | ------------ | ------------------------------------------------------- |
| `MCP_MAX_CONCURRENT_RG`| `8`            | Processos ripgrep paralelos máximos (mín: 1)        |
| `MCP_RG_TIMEOUT_MS`    | `30000`        | Tempo de espera do processo ripgrep em ms (mín: 1000) |

#### Depuração

| Variável    | Predefinição | Descrição                                     |
| ----------- | ------------ | --------------------------------------------- |
| `LOG_LEVEL` | `info`       | Verbosidade: `debug`, `info`, `warn`, `error` |

---

## Ferramentas (17)

### Criar & Restaurar

| Ferramenta       | Descrição                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `create_backup`  | Cria backup de um ficheiro antes que a IA o toque. Adiciona etiquetas e descrição para contexto |
| `batch_backup`   | Cria backup de muitos ficheiros de uma vez. Etiquetas partilhadas, uma só operação              |
| `restore_backup` | Restaura para qualquer versão anterior. Opcionalmente para um caminho diferente                 |

### Pesquisar & Encontrar

| Ferramenta              | Descrição                                                                         |
| ----------------------- | --------------------------------------------------------------------------------- |
| `list_backups`          | Encontra backups por ficheiro, etiquetas, intervalo de datas ou termo de pesquisa |
| `search_backups`        | Pesquisa por descrição, etiquetas ou nome do ficheiro                             |
| `get_backup`            | Metadados completos de um backup — tamanho, hash, etiquetas, carimbos temporais   |
| `get_backup_stats`      | Visão geral: quantos backups, tamanho total, etiquetas mais usadas                |
| `search_backup_content` | Pesquisa dentro dos ficheiros de backup com ripgrep (opcional)                    |

### Comparar & Pré-visualizar

| Ferramenta       | Descrição                                                                       |
| ---------------- | ------------------------------------------------------------------------------- |
| `diff_backup`    | Compara um backup com o ficheiro atual — ou com outro backup                    |
| `preview_backup` | Lê o conteúdo do backup sem restaurar. Usa `head`/`tail` para ficheiros grandes |

### Etiquetas

| Ferramenta    | Descrição                           |
| ------------- | ----------------------------------- |
| `add_tags`    | Categoriza um backup após a criação |
| `remove_tags` | Limpa backups mal etiquetados       |
| `list_tags`   | Vê todas as etiquetas em uso        |

### Manutenção

| Ferramenta        | Descrição                                                                       |
| ----------------- | ------------------------------------------------------------------------------- |
| `verify_backup`   | Verifica integridade do hash SHA-256 — deteta corrupção                         |
| `find_duplicates` | Encontra backups com conteúdo idêntico — recupera espaço desperdiçado           |
| `cleanup_backups` | Remove backups antigos ou excessivos. Usa `dryRun` primeiro para pré-visualizar |
| `delete_backup`   | Remove um backup específico                                                     |

---

## Arquitetura

```
src/
├── index.ts              # Entrada do servidor, handlers MCP, limitador de frequência
├── errors/               # Hierarquia de erros (BaseError para camada de pesquisa)
├── operations/           # Lógica de negócio (um ficheiro por domínio)
│   ├── filter-utils.ts   # SSOT partilhado de filtro+ordenação (list + search)
│   ├── create.ts         # Criação atómica de backups (copyAtomic)
│   ├── restore.ts        # Restauração atómica (temp + rename)
│   ├── diff.ts           # Comparação Myers diff
│   └── ...
├── search/               # Integração ripgrep
│   ├── ripgrep-executor.ts # Executor de processos limitado por semáforo
│   ├── ripgrep-args.ts    # Construtor de argumentos
│   └── ripgrep-types.ts   # Tipos de resultado
├── tools/                # Definições de ferramentas MCP (flag readOnly)
├── types/                # Interfaces TypeScript (BackupMetadata, parâmetros)
├── validation/           # Validação com regex
└── utils/                # Store, persistência, hashing, config, logger
    ├── concurrency.ts    # Semáforo, parallelMap, limitador de frequência
    ├── config.ts         # Análise de variáveis de ambiente com validação
    ├── fs.ts             # Cópia/escrita atómica, helpers de caminhos
    ├── myers-diff.ts     # Algoritmo LCS diff (O(n*m) limitado)
    └── validate.ts       # Path traversal + restrição de raízes
```

### Decisões Chave

- **Nunca perder metadados** — auto-guarda a cada 30s quando há alterações. Sem necessidade de guardar manualmente
- **Integridade em que podes confiar** — hash SHA-256 em cada backup. Verifica quando quiseres, deteta corrupção ao nível do bit
- **Restauro seguro** — `targetPath` permite restaurar para outro local em vez de sobrescrever o ficheiro ativo
- **Lote sem bloqueios** — concorrência baseada em semáforo (5 por predefinição). Todos os ficheiros com backup, nenhum skipado
- **Pesquisa dentro dos backups** — pesquisa de conteúdo com ripgrep significa que não precisas de restaurar para encontrar o que está lá dentro
- **Deduplicar para poupar espaço** — encontra backups idênticos pelo hash do conteúdo. Seguro eliminar, o original fica intacto

---

## Desenvolvimento

```bash
npm run build      # Compilar TypeScript
npm run watch      # Modo de observação
npm run inspector  # Executar inspector MCP para depuração
npm test           # Executar testes (vitest)
```

## Formato de Dados

Os backups são guardados em `BACKUP_DIR` com:

- **Cópias de ficheiros**: `{originalName}.{backupId}.{iso-timestamp}.backup`
- **Metadados**: `metadata.json` (auto-guardado a cada 30s quando há alterações)

---

## Segurança

- **Proteção contra path traversal** — sequências `..` e expansão de `~` validadas antes de qualquer acesso ao sistema de ficheiros
- **Restrição de raízes** — define `BACKUP_ALLOWED_ROOTS` para manter a IA dentro dos directórios do teu projeto
- **Verificação de hash** — verificação de integridade SHA-256 em cada backup e restauro
- **Todos os caminhos validados antes do acesso** — sem truques com symlinks, sem fugir das raízes

## Projeto complementar

[**Filesystem Pro**](https://github.com/lordc-dev/filesystem-pro) — dá à IA acesso real de programador à tua base de código. Pesquisa ripgrep, compreensão de código com tree-sitter em 17 linguagens, edições cirúrgicas baseadas em AST e uma pilha de desfazer completa. O Backup Pro versiona os teus ficheiros; o Filesystem Pro dá à IA as ferramentas para os editar com segurança.

## Licença

MIT — Consulte o [repositório original de MCP Servers](https://github.com/modelcontextprotocol/servers) para mais detalhes.

## Créditos

- Original: [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers)
- MCP SDK: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
