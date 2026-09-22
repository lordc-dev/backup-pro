/**
 * Ripgrep Executor
 *
 * Core ripgrep execution functionality.
 * Requires system ripgrep: brew install ripgrep
 *
 * Adapted from filesystem-pro with:
 * - Concurrency limiting (MAX_CONCURRENT_RG)
 * - Configurable timeout (RG_TIMEOUT_MS)
 * - Byte-limit execution (executeRipgrepWithLimit)
 * - PCRE2 detection
 */

import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

import { log } from "../utils/logger.js";
import { Semaphore } from "../utils/concurrency.js";

const MAX_CONCURRENT_RG = (() => {
  const parsed = process.env.MCP_MAX_CONCURRENT_RG ? Number.parseInt(process.env.MCP_MAX_CONCURRENT_RG, 10) : 8;
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 8;
})();
const RG_TIMEOUT_MS = (() => {
  const parsed = process.env.MCP_RG_TIMEOUT_MS ? Number.parseInt(process.env.MCP_RG_TIMEOUT_MS, 10) : 30_000;
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 30_000;
})();

const rgSemaphore = new Semaphore(MAX_CONCURRENT_RG);

const execFileAsync = promisify(execFile);

const CANDIDATE_PATHS = [
  "/opt/homebrew/bin/rg",
  "/usr/local/bin/rg",
  "/usr/bin/rg",
];

let cachedRgPath: string | null | undefined = undefined;

function isDebugMode(): boolean {
  return (process.env.LOG_LEVEL || "info") === "debug";
}

async function getRgPath(): Promise<string | null> {
  if (cachedRgPath !== undefined) return cachedRgPath;

  try {
    const { stdout } = await execFileAsync("which", ["rg"]);
    const resolved = stdout.trim();
    if (resolved) {
      cachedRgPath = resolved;
      if (isDebugMode()) log.debug("ripgrep", `Using ripgrep: ${resolved}`);
      return resolved;
    }
  } catch {
    // rg not found in PATH — will try candidate paths
  }

  for (const candidate of CANDIDATE_PATHS) {
    try {
      await execFileAsync(candidate, ["--version"]);
      cachedRgPath = candidate;
      if (isDebugMode()) log.debug("ripgrep", `Using ripgrep: ${candidate}`);
      return candidate;
    } catch {
      // rg not found at candidate path — continue probing
    }
  }

  log.error("ripgrep", "Ripgrep not found in PATH or common locations");
  log.error("ripgrep", "Install via: brew install ripgrep / apt install ripgrep");
  cachedRgPath = null;
  return null;
}

export class RipgrepNotFoundError extends Error {
  constructor() {
    super(
      "System ripgrep is not available.\n" +
      "Install via: brew install ripgrep"
    );
    this.name = "RipgrepNotFoundError";
  }
}

export async function isRipgrepAvailable(): Promise<boolean> {
  return (await getRgPath()) !== null;
}

export function requiresPCRE2(pattern: string): boolean {
  if (!pattern) return false;
  const pcre2Features = [
    /\(\?[=!<]/,
    /\(\?\w+:/,
    /\\[kKgG]/,
    /\(\?\w+\)/,
    /\(\?R\)/,
  ];
  return pcre2Features.some((regex) => regex.test(pattern));
}

function acquireSlot(): Promise<void> {
  return rgSemaphore.acquire();
}

function releaseSlot(): void {
  rgSemaphore.release();
}

function buildFinalArgs(args: string[], pcre2: boolean): string[] {
  return pcre2 ? ["--pcre2", ...args] : args;
}

/** Result of a byte-limited ripgrep execution. `warning` is set when the process
 *  died early (spawn error or timeout) — output may be partial. */
export interface RgExecutionResult {
  output: string;
  warning?: string;
}

export async function executeRipgrepWithLimit(
  args: string[],
  maxBytes: number,
  pcre2 = false
): Promise<RgExecutionResult> {
  const rgExecutable = await getRgPath();
  if (!rgExecutable) return { output: "", warning: "ripgrep executable not found" };

  await acquireSlot();

  return new Promise((resolve) => {
    let output = "";
    let totalBytes = 0;
    let killed = false;
    let warning: string | undefined;
    const finalArgs = buildFinalArgs(args, pcre2);
    const rg = spawn(rgExecutable, finalArgs);

    const timer = setTimeout(() => {
      if (!killed) {
        killed = true;
        warning = `ripgrep timed out after ${RG_TIMEOUT_MS}ms — results may be incomplete`;
        rg.kill("SIGTERM");
      }
    }, RG_TIMEOUT_MS);

    rg.stdout.on("data", (data: Buffer) => {
      if (!killed) {
        output += data.toString();
        totalBytes += data.length;
        if (totalBytes > maxBytes) {
          killed = true;
          warning = `output exceeded ${maxBytes} bytes — results truncated`;
          rg.kill("SIGTERM");
        }
      }
    });

    rg.stderr.on("data", (data: Buffer) => {
      log.debug("ripgrep", `stderr: ${data.toString().trim()}`);
    });

    rg.on("close", () => {
      clearTimeout(timer);
      releaseSlot();
      resolve({ output, ...(warning ? { warning } : {}) });
    });

    rg.on("error", (error: Error) => {
      clearTimeout(timer);
      releaseSlot();
      log.warn("ripgrep", `spawn error: ${error.message}`);
      resolve({ output, warning: `ripgrep spawn failed: ${error.message}` });
    });
  });
}