#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_ROOT = "/Users/jiangsheng/GitHub/liquid-glass/src";
const rootDir = path.resolve(process.argv[2] ?? DEFAULT_ROOT);

/**
 * 递归收集目录下所有文件绝对路径。
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(fullPath);
      }
      if (entry.isFile()) {
        return [fullPath];
      }
      return [];
    }),
  );
  return files.flat();
}

/**
 * 统计单个文件信息。
 * @param {string} fullPath
 */
async function getFileStat(fullPath) {
  const stat = await fs.stat(fullPath);
  const text = await fs.readFile(fullPath, "utf8");
  const lineCount = text.length === 0 ? 0 : text.split(/\r?\n/).length;
  return {
    fullPath,
    size: stat.size,
    lineCount,
  };
}

/**
 * 转成人类可读体积。
 * @param {number} bytes
 */
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 生成排行榜。
 * @param {{fullPath:string,size:number,lineCount:number}[]} allFiles
 * @param {".ts"|".wgsl"} ext
 * @param {number} limit
 */
function topByExt(allFiles, ext, limit) {
  return allFiles
    .filter((file) => file.fullPath.endsWith(ext))
    .sort((a, b) => b.size - a.size)
    .slice(0, limit)
    .map((file, index) => ({
      rank: index + 1,
      relativePath: path.relative(rootDir, file.fullPath),
      size: file.size,
      lineCount: file.lineCount,
    }));
}

/**
 * 打印排行榜。
 * @param {string} title
 * @param {{rank:number,relativePath:string,size:number,lineCount:number}[]} rows
 */
function printTable(title, rows) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("(无匹配文件)");
    return;
  }

  const rankWidth = Math.max(2, String(rows.length).length);
  const sizeWidth = Math.max(8, ...rows.map((r) => humanSize(r.size).length));
  const lineWidth = Math.max(4, ...rows.map((r) => String(r.lineCount).length));

  for (const row of rows) {
    const rank = String(row.rank).padStart(rankWidth, " ");
    const size = humanSize(row.size).padStart(sizeWidth, " ");
    const lines = String(row.lineCount).padStart(lineWidth, " ");
    console.log(`${rank}. ${size} | ${lines} 行 | ${row.relativePath}`);
  }
}

async function main() {
  try {
    const stat = await fs.stat(rootDir);
    if (!stat.isDirectory()) {
      throw new Error(`目标不是目录：${rootDir}`);
    }

    const filePaths = await collectFiles(rootDir);
    const allFiles = await Promise.all(
      filePaths.map((filePath) => getFileStat(filePath)),
    );

    const topTs = topByExt(allFiles, ".ts", 10);
    const topWgsl = topByExt(allFiles, ".wgsl", 5);

    console.log(`统计目录：${rootDir}`);
    printTable("最大的 10 个 .ts 文件（按字节）", topTs);
    printTable("最大的 5 个 .wgsl 文件（按字节）", topWgsl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`统计失败：${message}`);
    process.exitCode = 1;
  }
}

void main();
