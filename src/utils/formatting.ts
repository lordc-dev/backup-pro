import { BackupMetadata, BackupStats } from '../types/index.js';
import * as path from 'node:path';

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format a relative date (time ago)
 */
export function formatRelativeDate(date: string | Date): string {
  const now = new Date();
  const backupDate = new Date(date);
  const diffMs = now.getTime() - backupDate.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else {
    return 'a few seconds ago';
  }
}

/**
 * Format a backup entry for list display
 */
export function formatBackupEntry(backup: BackupMetadata): string {
  const lines: string[] = [];
  
  lines.push(`📁 ${path.basename(backup.originalPath)}`);
  lines.push(`   ID: ${backup.id}`);
  lines.push(`   📅 ${new Date(backup.timestamp).toLocaleString()} (${formatRelativeDate(backup.timestamp)})`);
  
  if (backup.description) {
    lines.push(`   📝 ${backup.description}`);
  }

  if (backup.tags && backup.tags.length > 0) {
    const tagList = backup.tags.map(tag => '#' + tag).join(' ');
    lines.push(`   🏷️  ${tagList}`);
  }
  
  if (backup.size !== undefined) {
    lines.push(`   💾 ${formatFileSize(backup.size)}`);
  }
  
  if (backup.relatedFiles && backup.relatedFiles.length > 0) {
    lines.push(`   🔗 Related files: ${backup.relatedFiles.join(', ')}`);
  }
  
  return lines.join('\n');
}

/**
 * Format multiple backups grouped by file
 */
export function formatBackupList(backups: BackupMetadata[]): string {
  if (backups.length === 0) {
    return '📭 No backups found';
  }
  
  // Group by file
  const grouped = new Map<string, BackupMetadata[]>();
  
  for (const backup of backups) {
    const key = backup.originalPath;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(backup);
  }
  
  const lines: string[] = [`📚 Found ${backups.length} backup${backups.length !== 1 ? 's' : ''}:\n`];
  
  for (const [filePath, fileBackups] of grouped.entries()) {
    lines.push(`\n🗂️  ${filePath} (${fileBackups.length} backup${fileBackups.length !== 1 ? 's' : ''}):`);
    lines.push('─'.repeat(50));
    
    // Sort by date (most recent first)
    fileBackups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    for (const backup of fileBackups) {
      lines.push(formatBackupEntry(backup));
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Format backup statistics
 */
export function formatBackupStats(stats: BackupStats): string {
  const lines: string[] = ['📊 Backup Statistics:\n'];
  
  lines.push(`📁 Total files backed up: ${stats.fileCount}`);
  lines.push(`💾 Total backups: ${stats.totalBackups}`);
  lines.push(`📦 Total space used: ${formatFileSize(stats.totalSize)}`);
  lines.push(`📏 Average size: ${formatFileSize(stats.averageBackupSize)}`);
  
  if (stats.oldestBackup) {
    lines.push(`\n🕰️  Oldest backup: ${formatRelativeDate(stats.oldestBackup)}`);
  }
  
  if (stats.newestBackup) {
    lines.push(`✨ Most recent backup: ${formatRelativeDate(stats.newestBackup)}`);
  }
  
  if (stats.topTags.length > 0) {
    lines.push('\n🏷️  Most used tags:');
    for (const { tag, count } of stats.topTags.slice(0, 5)) {
      lines.push(`   #${tag} (${count} use${count !== 1 ? 's' : ''})`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format cleanup result
 */
export function formatCleanupResult(result: {
  deletedCount: number;
  freedSpace: number;
  keptCount?: number;
}): string {
  const lines: string[] = ['🧹 Cleanup completed:\n'];
  
  if (result.deletedCount > 0) {
    lines.push(`🗑️  Deleted ${result.deletedCount} backup${result.deletedCount !== 1 ? 's' : ''}`);
    lines.push(`💾 Space freed: ${formatFileSize(result.freedSpace)}`);
  } else {
    lines.push('ℹ️  No backups found to delete');
  }
  
  if (result.keptCount !== undefined) {
    lines.push(`📌 Backups kept: ${result.keptCount}`);
  }
  
  return lines.join('\n');
}

/**
 * Format available tags
 */
export function formatTagList(tags: string[]): string {
  if (tags.length === 0) {
    return '🏷️  No tags available';
  }
  
  const lines = ['🏷️  Available tags:\n'];
  const tagGroups = [];
  
  // Group 5 tags per line
  for (let i = 0; i < tags.length; i += 5) {
    const group = tags.slice(i, i + 5).map(tag => `#${tag}`).join('  ');
    tagGroups.push(`   ${group}`);
  }
  
  lines.push(...tagGroups);
  
  return lines.join('\n');
}
