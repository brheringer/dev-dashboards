import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function loadConfigFile() {
  const configPath = path.join(rootDir, "config.json");
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

const fileConfig = loadConfigFile();

export const rootDirPath = rootDir;

export const config = {
  cutDate: fileConfig.cutDate,
  branding: {
    author: fileConfig.branding?.author || "brheringer",
    product: fileConfig.branding?.product || "undefined-product",
  },
  azureDevOps: {
    organization: process.env.ADO_ORG || fileConfig.azureDevOps.organization,
    project: fileConfig.azureDevOps.project,
    repositories: fileConfig.azureDevOps.repositories || [],
    areaPathsOfInterest: (fileConfig.azureDevOps.areaPathsOfInterest || [])
      .map((value) => String(value).trim())
      .filter(Boolean),
    authors: (fileConfig.azureDevOps.authors || [])
      .map((value) => String(value).trim())
      .filter(Boolean),
  },
  sonarCloud: {
    organization: fileConfig.sonarCloud?.organization,
    projects: fileConfig.sonarCloud?.projects || [],
  },
  secrets: {
    adoPat: process.env.ADO_PAT || "",
    sonarToken: process.env.SONAR_TOKEN || "",
  },
  port: Number(process.env.PORT) || 3000,
  cachePath: path.join(rootDir, "data", "cache.json"),
};

export function isAreaPathOfInterest(areaPath) {
  const allowed = config.azureDevOps.areaPathsOfInterest;
  if (!allowed.length) return true;
  return allowed.includes(areaPath || "");
}
