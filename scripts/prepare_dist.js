"use strict";

/**
 * Prepara a pasta dist/ para publicação estática (Netlify).
 * Copia apenas os artefatos necessários ao jogo no navegador.
 * Não inclui testes, documentação, servidor Node nem metadados de desenvolvimento.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const ROOT_FILES = ["index.html", "style.css"];

/** Módulos de runtime referenciados por index.html (ordem irrelevante para cópia). */
const RUNTIME_SCRIPTS = [
  "src/core/vilarejo_core.js",
  "src/shared/vilarejo_history_store.js",
  "src/events/eventos_v3.js",
  "src/economy/vilarejo_economy.js",
  "src/society/vilarejo_society.js",
  "src/politics/vilarejo_politics.js",
  "src/institutions/vilarejo_institutions.js",
  "src/services/vilarejo_services.js",
  "src/newspaper/vilarejo_newspaper.js",
  "src/intelligence/vilarejo_intelligence.js",
  "src/intelligence/intelligence_view.js",
  "src/ui/decision_observer.js",
  "src/ui/dashboard.js"
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(relativePath) {
  const source = path.join(ROOT, relativePath);
  const target = path.join(DIST, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo obrigatório ausente: ${relativePath}`);
  }
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  return relativePath;
}

function copyDirectoryContents(relativeDir) {
  const sourceDir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Diretório obrigatório ausente: ${relativeDir}`);
  }

  const copied = [];
  function walk(currentRelative) {
    const absolute = path.join(ROOT, currentRelative);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const childRelative = path.posix.join(currentRelative.split(path.sep).join("/"), entry.name);
      if (entry.isDirectory()) {
        walk(childRelative);
      } else if (entry.isFile()) {
        copyFile(childRelative);
        copied.push(childRelative);
      }
    }
  }
  walk(relativeDir.split(path.sep).join("/"));
  return copied;
}

function resetDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);
}

function verifyIndexScripts(indexHtml) {
  const referenced = [...indexHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]);
  const missingInBundle = referenced.filter((src) => !RUNTIME_SCRIPTS.includes(src));
  if (missingInBundle.length) {
    throw new Error(
      `index.html referencia scripts não listados no bundle de publicação: ${missingInBundle.join(", ")}`
    );
  }
  const missingOnDisk = RUNTIME_SCRIPTS.filter((src) => !referenced.includes(src));
  if (missingOnDisk.length) {
    throw new Error(
      `Bundle lista scripts ausentes no index.html: ${missingOnDisk.join(", ")}`
    );
  }
  return referenced;
}

function main() {
  const indexPath = path.join(ROOT, "index.html");
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const referencedScripts = verifyIndexScripts(indexHtml);

  resetDist();

  const manifest = {
    root: [],
    scripts: [],
    publicAssets: []
  };

  for (const file of ROOT_FILES) {
    manifest.root.push(copyFile(file));
  }

  for (const script of RUNTIME_SCRIPTS) {
    manifest.scripts.push(copyFile(script));
  }

  manifest.publicAssets = copyDirectoryContents("public");

  // Manifesto leve para auditoria local (não é necessário em runtime).
  const report = {
    generatedAt: new Date().toISOString(),
    rootFiles: manifest.root,
    scripts: manifest.scripts,
    publicAssets: manifest.publicAssets,
    scriptCount: manifest.scripts.length,
    referencedByIndex: referencedScripts
  };
  fs.writeFileSync(path.join(DIST, "build-manifest.json"), JSON.stringify(report, null, 2) + "\n");

  console.log("✓ dist/ preparado para publicação estática");
  console.log(`  HTML/CSS: ${manifest.root.length}`);
  console.log(`  Scripts:  ${manifest.scripts.length}`);
  console.log(`  Públicos: ${manifest.publicAssets.length}`);
}

main();
