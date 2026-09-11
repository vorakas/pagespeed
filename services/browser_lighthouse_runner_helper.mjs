#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function executableCandidates(command) {
  if (path.isAbsolute(command) || command.includes(path.sep)) {
    return [command];
  }

  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const extensions =
    os.platform() === "win32"
      ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
      : [""];

  return pathEntries.flatMap((entry) =>
    extensions.map((extension) => path.join(entry, `${command}${extension}`)),
  );
}

function resolveExecutable(command, label, envVar, installHint) {
  for (const candidate of executableCandidates(command)) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        return fs.realpathSync(candidate);
      }
    } catch {
      // Try the next PATH entry.
    }
  }

  fail(`${label} executable not found: ${command}. ${installHint} or set ${envVar}.`);
}

function packageRootsFromNpm() {
  try {
    return [
      execFileSync("npm", ["root", "-g"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    ].filter(Boolean);
  } catch {
    return [];
  }
}

function findPackageRootFromPath(startPath, packageName) {
  let current = fs.statSync(startPath).isDirectory()
    ? startPath
    : path.dirname(startPath);

  while (current && current !== path.dirname(current)) {
    const manifestPath = path.join(current, "package.json");
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (manifest.name === packageName) {
        return current;
      }
    } catch {
      // Keep walking up from binary wrappers and package subdirectories.
    }
    current = path.dirname(current);
  }

  return null;
}

function resolvePackage(packageName, extraPaths = []) {
  const searchPaths = [
    path.dirname(fileURLToPath(import.meta.url)),
    process.cwd(),
    ...extraPaths,
    ...packageRootsFromNpm(),
  ];

  for (const searchPath of searchPaths) {
    try {
      return require.resolve(packageName, { paths: [searchPath] });
    } catch {
      // Try the next package root.
    }
  }

  return null;
}

async function importPackage(packageName, friendlyName, extraPaths = []) {
  const resolved = resolvePackage(packageName, extraPaths);
  if (!resolved) {
    fail(
      `Unable to load ${friendlyName} package. Install runtime dependency '${packageName}' in the server image.`,
    );
  }

  return import(pathToFileURL(resolved).href);
}

function cookieOriginFor(url) {
  try {
    return new URL(url).origin;
  } catch {
    fail(`Invalid warmup URL for cookie setup: ${url}`);
  }
}

function buildCookieMutations(warmupUrl, cookies, clearCookies) {
  const url = cookieOriginFor(warmupUrl);
  const removals = Array.isArray(clearCookies)
    ? clearCookies
        .filter((name) => typeof name === "string" && name.trim())
        .map((name) => ({
          name,
          value: "",
          url,
          path: "/",
          expires: 0,
        }))
    : [];
  const additions =
    cookies && typeof cookies === "object" && !Array.isArray(cookies)
      ? Object.entries(cookies)
          .filter(([name, value]) => name && value !== undefined && value !== null)
          .map(([name, value]) => ({
            name,
            value: String(value),
            url,
            path: "/",
          }))
      : [];

  return [...removals, ...additions];
}

async function main() {
  if (process.argv.length < 3) {
    fail("Missing Lighthouse helper JSON payload.");
  }

  let payload;
  try {
    payload = JSON.parse(process.argv[2]);
  } catch {
    fail("Invalid Lighthouse helper JSON payload.");
  }

  const warmupUrl = payload.warmupUrl;
  const auditUrl = payload.auditUrl;
  const profileDir = payload.profileDir;
  const lighthouseBin = payload.lighthouseBin || process.env.LIGHTHOUSE_BIN || "lighthouse";
  const chromeBin = payload.chromeBin || process.env.CHROME_BIN || "chromium";
  const formFactor = payload.formFactor === "mobile" ? "mobile" : "desktop";

  if (!warmupUrl || !auditUrl || !profileDir) {
    fail("Lighthouse helper payload missing warmupUrl, auditUrl, or profileDir.");
  }
  const cookieMutations = buildCookieMutations(
    warmupUrl,
    payload.cookies,
    payload.clearCookies,
  );

  const lighthouseExecutable = resolveExecutable(
    lighthouseBin,
    "Lighthouse",
    "LIGHTHOUSE_BIN",
    "Install Lighthouse",
  );
  const chromeExecutable = resolveExecutable(
    chromeBin,
    "Chrome",
    "CHROME_BIN",
    "Install Chromium/Chrome",
  );
  const lighthousePackageRoot = findPackageRootFromPath(
    lighthouseExecutable,
    "lighthouse",
  );
  const packageSearchPaths = lighthousePackageRoot ? [lighthousePackageRoot] : [];

  const lighthouseModule = await importPackage(
    "lighthouse",
    "Lighthouse runtime",
    packageSearchPaths,
  );
  const chromeLauncherModule = await importPackage(
    "chrome-launcher",
    "chrome-launcher",
    packageSearchPaths,
  );
  const puppeteerModule = await importPackage(
    "puppeteer-core",
    "puppeteer-core",
    packageSearchPaths,
  );

  const lighthouse = lighthouseModule.default || lighthouseModule;
  const chromeLauncher = chromeLauncherModule.default || chromeLauncherModule;
  const puppeteer = puppeteerModule.default || puppeteerModule;
  let chrome;
  let browser;

  try {
    chrome = await chromeLauncher.launch({
      chromePath: chromeExecutable,
      chromeFlags: [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        `--user-data-dir=${profileDir}`,
      ],
    });

    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${chrome.port}`,
      defaultViewport: null,
    });
    const page = await browser.newPage();
    if (cookieMutations.length > 0) {
      await page.setCookie(...cookieMutations);
    }
    await page.goto(warmupUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 15000 }).catch(() => {});
    await page.close();
    await browser.disconnect();
    browser = null;

    const result = await lighthouse(auditUrl, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      disableStorageReset: true,
      onlyCategories: ["performance"],
      formFactor,
      screenEmulation:
        formFactor === "desktop"
          ? { disabled: true }
          : {
              disabled: false,
              mobile: true,
              width: 412,
              height: 823,
              deviceScaleFactor: 1.75,
            },
    });

    process.stdout.write(result.report);
  } finally {
    if (browser) {
      await browser.disconnect();
    }
    if (chrome) {
      await chrome.kill();
    }
  }
}

main().catch((error) => {
  fail(error?.stack || error?.message || String(error));
});
