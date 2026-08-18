import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

function cacheBackupPath() {
  return `${config.cachePath}.bak`;
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function readCache() {
  const cache = readJsonFile(config.cachePath);
  if (cache) return cache;
  return readJsonFile(cacheBackupPath());
}

export function writeCache(data) {
  const cachePath = config.cachePath;
  const dir = path.dirname(cachePath);
  fs.mkdirSync(dir, { recursive: true });

  const tmpPath = `${cachePath}.tmp`;
  const bakPath = cacheBackupPath();
  const json = JSON.stringify(data, null, 2);

  fs.writeFileSync(tmpPath, json, "utf8");

  try {
    if (fs.existsSync(cachePath)) {
      fs.copyFileSync(cachePath, bakPath);
    }
    fs.copyFileSync(tmpPath, cachePath);
  } catch (error) {
    const backup = readJsonFile(bakPath);
    if (backup && !readJsonFile(cachePath)) {
      fs.copyFileSync(bakPath, cachePath);
    }
    throw error;
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}

export function hasCache() {
  return Boolean(readCache());
}
