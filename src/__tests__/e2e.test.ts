import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BackupServer } from '../index.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';

const TMP_DIR = path.join(os.tmpdir(), `backup-e2e-${Date.now()}`);

describe('E2E: BackupServer tool handlers', () => {
  let server: BackupServer;
  let backups: any;

  beforeAll(async () => {
    await fs.mkdir(TMP_DIR, { recursive: true });
    server = new BackupServer();
    await (server as any).init();
    backups = (server as any).backups;
  });

  afterAll(async () => {
    (server as any).backups.stopAutoSave();
    try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  });

  it('has all expected tools registered', () => {
    const tools = (server as any).getAllTools();
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('create_backup');
    expect(names).toContain('restore_backup');
    expect(names).toContain('delete_backup');
    expect(names).toContain('list_backups');
    expect(names).toContain('search_backups');
    expect(names).toContain('get_backup');
    expect(names).toContain('diff_backup');
    expect(names).toContain('preview_backup');
    expect(names).toContain('verify_backup');
    expect(names).toContain('cleanup_backups');
    expect(names).toContain('batch_backup');
    expect(names).toContain('add_tags');
    expect(names).toContain('remove_tags');
    expect(names).toContain('list_tags');
    expect(names).toContain('search_backup_content');
    expect(names).toContain('find_duplicates');
    expect(names).toContain('get_backup_stats');
    expect(names.length).toBe(17);
  });

  it('create + get + delete lifecycle works through tool handlers', async () => {
    const testFile = path.join(TMP_DIR, 'handler-test.txt');
    await fs.writeFile(testFile, 'handler test content');

    const tools = (server as any).getAllTools();
    const createTool = tools.find((t: any) => t.name === 'create_backup');
    const deleteTool = tools.find((t: any) => t.name === 'delete_backup');

    const createResult = await createTool.handler({
      filePath: testFile,
      description: 'handler test',
      tags: ['e2e-handler'],
    }, backups);

    expect(createResult.text).toContain('handler-test.txt');
    expect(createResult.text).toContain('created');

    const idMatch = createResult.text.match(/ID:\s+(\w+)/);
    expect(idMatch).not.toBeNull();
    const backupId = idMatch![1];

    const deleteResult = await deleteTool.handler({ backupId }, backups);
    expect(deleteResult.text).toContain('deleted');
  });

  it('batch backup handler works', async () => {
    const files = [];
    for (let i = 0; i < 2; i++) {
      const f = path.join(TMP_DIR, `handler-batch-${i}.txt`);
      await fs.writeFile(f, `batch ${i}`);
      files.push(f);
    }

    const tools = (server as any).getAllTools();
    const batchTool = tools.find((t: any) => t.name === 'batch_backup');

    const result = await batchTool.handler({
      filePaths: files,
      description: 'batch handler test',
      tags: ['e2e-batch'],
    }, backups);

    expect(result.text).toContain('Batch Backup');
  });

  it('stats handler returns data', async () => {
    const tools = (server as any).getAllTools();
    const statsTool = tools.find((t: any) => t.name === 'get_backup_stats');

    const result = await statsTool.handler({}, backups);
    expect(result.text).toContain('Total');
  });

  it('tags handler works', async () => {
    const tools = (server as any).getAllTools();
    const listTagsTool = tools.find((t: any) => t.name === 'list_tags');

    const result = await listTagsTool.handler({}, backups);
    expect(result.text).toBeDefined();
  });
});