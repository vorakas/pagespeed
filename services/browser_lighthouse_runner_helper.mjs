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

function expectedModeFromCookies(cookies) {
  if (cookies?.forceNew === "true") {
    return "adobe_commerce";
  }
  if (cookies?.forceOld === "true") {
    return "lampsplus";
  }
  return "unknown";
}

function cookieValue(cookieMap, name) {
  return cookieMap.get(name) || "absent";
}

function detectedModeFromCookieMap(cookieMap) {
  const forceNew = cookieValue(cookieMap, "forceNew");
  const forceOld = cookieValue(cookieMap, "forceOld");
  if (forceNew === "true" && forceOld === "absent") {
    return "adobe_commerce";
  }
  if (forceOld === "true" && forceNew === "absent") {
    return "lampsplus";
  }
  return "unknown";
}

function modeEvidenceFromCookies(expectedCookies, observedCookies) {
  const cookieMap = new Map(observedCookies.map((cookie) => [cookie.name, cookie.value]));
  const expectedMode = expectedModeFromCookies(expectedCookies);
  const detectedMode = detectedModeFromCookieMap(cookieMap);
  const evidence = `forceNew=${cookieValue(cookieMap, "forceNew")}; forceOld=${cookieValue(cookieMap, "forceOld")}`;
  return { expectedMode, detectedMode, evidence };
}

function viewportForFormFactor(formFactor) {
  if (formFactor === "mobile") {
    return {
      width: 412,
      height: 823,
      deviceScaleFactor: 1.75,
      isMobile: true,
      hasTouch: true,
    };
  }

  return {
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  };
}

async function observeLiveCls({
  puppeteer,
  chrome,
  auditUrl,
  cookieMutations,
  formFactor,
  observationMs,
}) {
  let probeBrowser;
  let page;
  try {
    probeBrowser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${chrome.port}`,
      defaultViewport: null,
    });
    page = await probeBrowser.newPage();
    await page.setViewport(viewportForFormFactor(formFactor));
    if (cookieMutations.length > 0) {
      await page.setCookie(...cookieMutations);
    }
    await page.evaluateOnNewDocument(() => {
      window.__pharosClsProbe = {
        cls: 0,
        shiftCount: 0,
        largestShift: 0,
        largestShiftNode: null,
      };

      function nodeSnippet(node) {
        const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
        if (!element?.tagName) {
          return null;
        }
        const attrs = ["id", "class", "src", "href", "alt"]
          .map((name) => {
            const value = element.getAttribute(name);
            return value ? `${name}="${String(value).slice(0, 120)}"` : "";
          })
          .filter(Boolean)
          .join(" ");
        return `<${element.tagName.toLowerCase()}${attrs ? ` ${attrs}` : ""}>`;
      }

      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) {
              continue;
            }
            window.__pharosClsProbe.cls += entry.value;
            window.__pharosClsProbe.shiftCount += 1;
            if (entry.value > window.__pharosClsProbe.largestShift) {
              window.__pharosClsProbe.largestShift = entry.value;
              window.__pharosClsProbe.largestShiftNode = nodeSnippet(entry.sources?.[0]?.node);
            }
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
      } catch (error) {
        window.__pharosClsProbe.error = String(error?.message || error);
      }
    });

    await page.goto(auditUrl, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((resolve) => setTimeout(resolve, observationMs));
    const probe = await page.evaluate(() => window.__pharosClsProbe || null);
    return {
      cls: probe?.cls || 0,
      shiftCount: probe?.shiftCount || 0,
      largestShift: probe?.largestShift || null,
      largestShiftNode: probe?.largestShiftNode || null,
      observationMs,
      error: probe?.error || null,
    };
  } catch (error) {
    return {
      cls: null,
      shiftCount: null,
      largestShift: null,
      largestShiftNode: null,
      observationMs,
      error: String(error?.message || error),
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (probeBrowser) {
      await probeBrowser.disconnect();
    }
  }
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
    const modeEvidence = modeEvidenceFromCookies(
      payload.cookies,
      await page.cookies(cookieOriginFor(warmupUrl)),
    );
    if (
      modeEvidence.expectedMode !== "unknown" &&
      modeEvidence.detectedMode !== modeEvidence.expectedMode
    ) {
      fail(
        `Mode verification failed: expected ${modeEvidence.expectedMode}, detected ${modeEvidence.detectedMode} (${modeEvidence.evidence}).`,
      );
    }
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
    const clsProbe = await observeLiveCls({
      puppeteer,
      chrome,
      auditUrl,
      cookieMutations,
      formFactor,
      observationMs: Number(payload.clsProbeObservationMs) || 5000,
    });

    process.stdout.write(JSON.stringify({
      report: JSON.parse(result.report),
      modeEvidence,
      clsProbe,
    }));
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
