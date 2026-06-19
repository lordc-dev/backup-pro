/**
 * Environment Preloader — MUST be the first import in the entry point.
 *
 * ESM hoists and evaluates all imports before any module-level statements.
 * If `dotenv.config()` lives in index.ts as a statement (not an import),
 * it runs AFTER config.ts init code that calls `process.env`,
 * caching stale env values. This module ensures `.env` is loaded before
 * any config-dependent module initializes.
 *
 * Loads `.env` from the project root (the directory containing this file's
 * parent), NOT from `process.cwd()`. When launched as a child process with
 * an absolute path (e.g. by opencode), cwd points elsewhere and dotenv's
 * default lookup would silently skip the project's `.env`.
 *
 * `import "./preload-env.js"` is a side-effect import — ESM preserves
 * side-effect import execution order relative to other imports.
 */

import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/preload-env.ts → project root is two levels up.
const projectRoot = join(__dirname, "..");
const envPath = join(projectRoot, ".env");

dotenv.config({ path: envPath });