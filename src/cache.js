import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export function readCache() {
  const cachePath = config.cachePath;
  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeCache(data) {
  const cachePath = config.cachePath;
  const dir = path.dirname(cachePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf8");
}

export function hasCache() {
  return fs.existsSync(config.cachePath);
}
