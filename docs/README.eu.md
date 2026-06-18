# Backup Pro

[English](../README.md) | [Español](README.es.md) | [Català](README.ca.md) | [Galego](README.gl.md) | [Euskara](README.eu.md) | [Français](README.fr.md) | [Português](README.pt.md)

**AIak zure kodea editatzen duen aldiro, jatorrizkoa galtzeko arriskua duzu.** Backup Pro-ek hori konpontzen du — AI-k ukitu aurretik fitxategi bakoitzaren bertsioa egin, babeskopiak berehala bilatu eta konparatu, klik batekin leheneratu. SHA-256 osotasuna, deduplikazioa, batch eragiketak. 17 tresna. Claude, Cursor eta MCP bateragarriako edozein AI-rekin funtzionatzen du.

> [Anthropic MCP Backup Server](https://github.com/modelcontextprotocol/servers)-en **aurretik hobetua** — fitxategien bertsionatzea, etiketak, bilaketa, diff, egiaztapena, deduplikazioa eta batch eragiketak.

_Built and maintained by:_

[![LinkedIn](https://img.shields.io/badge/LinkedIn-albertocastrootero-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/albertocastrootero)

---

## Zergatik Backup Pro?

- **AI-k zure fitxategia editatu eta orain hondatuta dago?** — klik bat edozein aurreko bertsiora leheneratzeko. Babeskopia bakoitza itzuli dezakezun kontrol-puntu bat da
- **Zer aldatu den jakin nahi duzu?** — edozein babeskopia uneko fitxategiaren edo beste babeskopia baten aurka konparatu. Zehatz-mehatz ikusi zer gehitu, kendu edo aldatu den
- **Fitxategi asko aldi berean editatzen?** — batch babeskopia egin errefaktorizatu aurretik. Etiketa eta deskribapen komuna fitxategi guztietan, eragiketa bakarrean
- **Hondatzeaz kezkaturik?** — SHA-256 hash egiaztapenak edozein bit-mailako aldaketa antzematen du. Egiaztatu leheneratu ondoren, egiaztatu nonahikan
- **Diskoko lekua alferrik galtzen bikoiztuekin?** — babeskopia berdin-berdinak aurkitu eta lekua berreskuratu. Deduplikazioa barne

---

## Instalazioa

### 1. Instalatu ripgrep (aukerakoa — `search_backup_content` erabiltzeko)

| Plataforma           | Komandoa                                 |
| -------------------- | ---------------------------------------- |
| **macOS**            | `brew install ripgrep`                   |
| **Debian/Ubuntu**    | `sudo apt install ripgrep`               |
| **Fedora**           | `sudo dnf install ripgrep`               |
| **Arch**             | `sudo pacman -S ripgrep`                 |
| **Windows (winget)** | `winget install BurntSushi.ripgrep.MSVC` |
| **Windows (scoop)**  | `scoop install ripgrep`                  |
| **Windows (choco)**  | `choco install ripgrep`                  |

> Ripgrep gabe, tresna guztiak funtzionatzen dute `search_backup_content` izan ezik.

### 2. Instalatu eta eraiki zerbitzaria

```bash
cd /path/to/backup-pro
npm install
npm run build
```

## Konfigurazioa

Gehitu zure MCP bezeroaren konfigurazioari (`env` blokerik gabe — zerbitzariak aldagaiak bere direktorioko `.env` fitxategi batetik irakurtzen ditu dotenv bidez):

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

### Ingurune-aldagaiak

Kopiatu `.env.example` `.env` fitxategira proiektuaren erroan eta doitu balioak:

```bash
cp .env.example .env
```

Zerbitzariak `.env` automatikoki kargatzen du abiaraztean. Ez jarri ingurune-aldagaiak MCP bezeroaren konfigurazioan — mantendu itzazaite `.env` fitxategian zerbitzariaren balio lehenetsiak eta balidapena aplikatzeko.

#### Segurtasuna

| Aldagaia               | Lehenetsia       | Deskribapena                                                                                |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `BACKUP_ALLOWED_ROOTS` | (bide guztiak)   | AI zure proiektu-direktorioen barruan mantentzen du. Errotik bereizituta, kakotxaz banatuta |
| `BACKUP_DIR`           | `~/.mcp-backups` | Babeskopiak eta metadatuak non gorde                                                        |

#### Mugak

| Aldagaia                | Lehenetsia | Deskribapena                                                                  |
| ----------------------- | ---------- | ---------------------------------------------------------------------------- |
| `AUTO_SAVE_INTERVAL_MS` | `30000`    | Zenbat maiztasunekin gordetzen diren metadatuak automatikoki (ms)            |
| `MAX_PREVIEW_CHARS`     | `10000`    | Aurreikuspeneko karaktere maximoa — testuingurua lehorrtzea eragozten du   |
| `BATCH_CONCURRENCY`     | `5`        | Batch eragiketetako fitxategi-kopia paralelo maximoa (min: 1)              |
| `MAX_BACKUPS_PER_FILE`  | `0`            | Fitxategiko backup maximoak garbiketaren abisua egin baino lehen (0 = mugagabea) |
| `MAX_FILE_SIZE`         | `104857600`    | Backup eragiketetarako fitxategi-tamaina maximoa (100 MB lehenetsia)       |
| `MAX_DIFF_SIZE`         | `10485760`     | Diff eragiketetarako fitxategi-tamaina maximoa (10 MB lehenetsia)          |
| `MAX_HASH_SIZE`         | `104857600`    | get/verify-n hash-kalkulurako fitxategi-tamaina maximoa (100 MB lehenetsia) |

#### Bilaketa (ripgrep)

| Aldagaia               | Lehenetsia | Deskribapena                                           |
| ---------------------- | ---------- | ------------------------------------------------------- |
| `MCP_MAX_CONCURRENT_RG`| `8`            | Ripgrep prozesu paralelo maximoa (min: 1)              |
| `MCP_RG_TIMEOUT_MS`    | `30000`        | Ripgrep prozesuaren itxarote-denbora ms-tan (min: 1000) |

#### Arazketa

| Aldagaia    | Lehenetsia | Deskribapena                                       |
| ----------- | ---------- | -------------------------------------------------- |
| `LOG_LEVEL` | `info`     | Zehaztasun-maila: `debug`, `info`, `warn`, `error` |

---

## Tresnak (17)

### Sortu eta Leheneratu

| Tresna           | Deskribapena                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `create_backup`  | Egin fitxategi baten babeskopia AI-k ukitu aurretik. Gehitu etiketak eta deskribapena testuingururako |
| `batch_backup`   | Egin fitxategi askoren babeskopia aldi berean. Etiketa komuna, eragiketa bakarra                      |
| `restore_backup` | Leheneratu edozein aurreko bertsiora. Aukeran beste bide batera                                       |

### Bilatu eta Landu

| Tresna                  | Deskribapena                                                                   |
| ----------------------- | ------------------------------------------------------------------------------ |
| `list_backups`          | Aurkitu babeskopiak fitxategi, etiketa, data tartea edo bilaketa terminoagatik |
| `search_backups`        | Bilatu deskribapena, etiketak edo fitxategi-izenagatik                         |
| `get_backup`            | Babeskopia baten metadatu osoa — tamaina, hash, etiketak, data-zigiluak        |
| `get_backup_stats`      | Ikuspegi orokorra: zenbat babeskopia, tamaina osoa, etiketa erabilienak        |
| `search_backup_content` | Bilatu babeskopia-fitxategien barruan ripgrep-ekin (aukerakoa)                 |

### Konparatu eta Aurreikusi

| Tresna           | Deskribapena                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `diff_backup`    | Konparatu babeskopia bat uneko fitxategiaren aurka — edo beste babeskopia baten aurka       |
| `preview_backup` | Irakurri babeskopiaren edukia leheneratu gabe. Erabili `head`/`tail` fitxategi handietarako |

### Etiketak

| Tresna        | Deskribapena                           |
| ------------- | -------------------------------------- |
| `add_tags`    | Kategorizatu babeskopia sortu ondoren  |
| `remove_tags` | Garbitu etiketa okerdun babeskopiak    |
| `list_tags`   | Ikusi erabiltzen diren etiketa guztiak |

### Mantentzea

| Tresna            | Deskribapena                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| `verify_backup`   | Egiaztatu SHA-256 hash osotasuna — antzeman hondatzea                       |
| `find_duplicates` | Aurkitu eduki berdin-berdineko babeskopiak — berreskuratu alferrikako lekua |
| `cleanup_backups` | Garbitu babeskopia zahar edo gehiegi. Erabili `dryRun` aurreikusteko        |
| `delete_backup`   | Ezabatu babeskopia zehatz bat                                               |

---

## Arkitektura

```
src/
├── index.ts              # Zerbitzariaren sarrera, MCP maneiatzaileak, maiztasun-mugagailua
├── errors/               # Errore-hierarkia (BaseError bilaketa-geruzarako)
├── operations/           # Negozio-logika (fitxategi bat domeinu bakoitzeko)
│   ├── filter-utils.ts   # Iragazki+ordenazioa SSOT partekatua (list + search)
│   ├── create.ts         # Backup sorkuntza atomikoa (copyAtomic)
│   ├── restore.ts        # Berrespena atomikoa (temp + rename)
│   ├── diff.ts           # Myers diff konparazioa
│   └── ...
├── search/               # Ripgrep integrazioa
│   ├── ripgrep-executor.ts # Semaforoz mugatutako prozesu-exekutatzailea
│   ├── ripgrep-args.ts    # Argumentu-egilea
│   └── ripgrep-types.ts   # Emaitza-motak
├── tools/                # MCP tresnen definizioak (readOnly bandera)
├── types/                # TypeScript interfazeak (BackupMetadata, parametroak)
├── validation/           # Regex balidazioa
└── utils/                # Biltegia, iraunkortasuna, hashing-a, konfigurazioa, erregistratzailea
    ├── concurrency.ts    # Semaforoa, parallelMap, maiztasun-mugagailua
    ├── config.ts         # Ingurune-aldagaien analisia balidazioarekin
    ├── fs.ts             # Kopia/idazketa atomikoa, bide-headersak
    ├── myers-diff.ts     # LCS diff algoritmoa (O(n*m) mugatua)
    └── validate.ts       # Path traversal + erro-murrizketa
```

### Erabaki gakoenak

- **Metadaturik inoiz galdu gabe** — gorde automatikoki 30s-ro zikinkeria dagoenean. Ez da eskuz gordetzerik behar
- **Konfiantzazko osotasuna** — SHA-256 hash babeskopia bakoitzean. Egiaztatu noahi, bit-mailako hondatzea antzematen du
- **Leheneratze segurua** — `targetPath`-k beste leku batera leheneratzea ahalbidetzen du fitxategi aktiboa gainidatzi beharrean
- **Batch blokeorik gabe** — semaforoan oinarritutako aldiberekotasuna (5 lehenetsia). Fitxategi guztiak babeskopiatu, bat ere kanpoan gabe
- **Bilatu babeskopien barruan** — ripgrep eduki-bilaketak ez du leheneratu behar barruan zer dagoen aurkitzeko
- **Deduplikatu lekua aurrezteko** — aurkitu babeskopia berdin-berdinak eduki-hash-aren arabera. Seguru ezabatzeko, jatorrizkoa osorik mantentzen da

---

## Garapena

```bash
npm run build      # Konpilatu TypeScript
npm run watch      # Begizta modua
npm run inspector  # Exekutatu MCP inspektorea arazketarako
npm test           # Exekutatu probak (vitest)
```

## Datu-formatua

Babeskopiak `BACKUP_DIR`-en gordetzen dira hauekin:

- **Fitxategi-kopiak**: `{originalName}.{backupId}.{iso-timestamp}.backup`
- **Metadatuak**: `metadata.json` (zikinkeria dagoenean 30s-ro automatikoki gordeta)

---

## Segurtasuna

- **Bide-traversio babeskopia** — `..` sekuentziak eta `~` hedapena balidatzen dira edozein fitxategi-sisteman sartu aurretik
- **Erro-murrizketa** — ezarri `BACKUP_ALLOWED_ROOTS` AI zure proiektu-direktorioen barruan mantentzeko
- **Hash egiaztapena** — SHA-256 osotasun-egiaztapena babeskopia eta leheneratze bakoitzean
- **Bide guztiak balidatuta sarbide aurretik** — symlink trukirik ez, erro-etabiderik gabe

## Proiektu lagunak

[**Filesystem Pro**](https://github.com/lordc-dev/filesystem-pro) — AI laguntzaileei zure kode-fitxategiak irakurtzeko, bilatzeko, editatzeko eta antolatzeko sarbide segurua ematen die — garatzaile batek bezala. Ripgrep bilaketa, tree-sitter kode-ulertzea 17 hizkuntzatan, AST-n oinarritutako edizio kirurgikoak eta desegite-pila osoa. Backup Pro-k zure fitxategiak bertsionatzen ditu; Filesystem Pro-k AI-ri fitxategiak seguru editatzeko tresnak ematen dizkio.

[**Security Tools Pro**](https://github.com/lordc-dev/security-tools-pro) — 59 tresna. Zerbitzari bat. Segurtasun-estaldura osoa. Zaurgarritasun-inteligentzia, SAST, ezagutza, sekretuen eskaneatzea, dependentzien auditoretza, exploit-ikerketa eta txostenak — dena integratuta IA-k triatu, eskaneatu eta txostentzeko 10 CLI tresna eta 5 arakatzaile-fitxen arteko testuinguru-aldaketarik gabe.

## Lizentzia

MIT — Ikusi [jatorrizko MCP Servers biltegia](https://github.com/modelcontextprotocol/servers) xehetasunetarako.

## Kredituak

- Jatorrizkoa: [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers)
- MCP SDK: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
