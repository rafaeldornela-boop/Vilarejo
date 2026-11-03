"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "../../");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function requestRaw(baseUrl, requestTarget, method = "GET") {
  const { hostname, port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname, port, path: requestTarget, method }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    });
    request.once("error", reject);
    request.end();
  });
}

async function waitForServer(baseUrl, child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Servidor encerrou com código ${child.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Servidor não ficou pronto a tempo.");
}

async function assertServedAsset(baseUrl, assetPath) {
  const response = await fetch(new URL(assetPath, baseUrl));
  assert.equal(response.status, 200, `recurso local ${assetPath} deve responder 200`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  return response;
}

(async () => {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: "ignore"
  });

  try {
    await waitForServer(baseUrl, child);

    const root = await assertServedAsset(baseUrl, "/");
    assert.match(root.headers.get("content-type"), /^text\/html\b/);
    const html = await root.text();
    assert.match(html, /<title>Vilarejo/);
    const explicitIndex = await assertServedAsset(baseUrl, "/index.html");
    assert.match(explicitIndex.headers.get("content-type"), /^text\/html\b/);

    const css = await assertServedAsset(baseUrl, "/style.css");
    assert.match(css.headers.get("content-type"), /^text\/css\b/);
    const cssText = await css.text();
    assert.match(cssText, /\.politics-dashboard/);

    const localReferences = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((reference) => !reference.startsWith("#") && !/^(?:[a-z]+:|\/\/)/i.test(reference));
    const scriptReferences = localReferences.filter((reference) => /\.js(?:[?#]|$)/i.test(reference));
    assert.equal(scriptReferences.length, 13, "index deve referenciar os treze módulos JavaScript de runtime");
    for (const reference of localReferences) {
      const assetUrl = new URL(reference, baseUrl);
      assert.equal(assetUrl.origin, baseUrl, `referência local permanece na origem ${reference}`);
      const asset = await assertServedAsset(baseUrl, assetUrl.pathname);
      if (/\.js$/i.test(assetUrl.pathname)) assert.match(asset.headers.get("content-type"), /^text\/javascript\b/);
    }

    const cssAssetReferences = [...cssText.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)]
      .map((match) => match[1].trim())
      .filter((reference) => !/^(?:data:|https?:|\/\/|#)/i.test(reference));
    for (const reference of cssAssetReferences) {
      const assetUrl = new URL(reference, new URL("/style.css", baseUrl));
      assert.equal(assetUrl.origin, baseUrl);
      await assertServedAsset(baseUrl, assetUrl.pathname);
    }

    const publicAudioPath = "/public/assets/audio/morning_light_on_cobblestone.mp3";
    assert.ok(fs.existsSync(path.join(ROOT, publicAudioPath.slice(1))), "asset público esperado está versionado");
    const audio = await assertServedAsset(baseUrl, publicAudioPath);
    assert.match(audio.headers.get("content-type"), /^audio\/mpeg\b/);
    assert.ok(Number(audio.headers.get("content-length")) > 0);

    const forbiddenPaths = [
      "/package.json",
      "/package-lock.json",
      "/.env.example",
      "/.git/config",
      "/src/test/test_runner.js",
      "/src/test/module_integration_test.js",
      "/src/economy/config.json",
      "/public/secret.json",
      "/missing.js"
    ];
    for (const requestPath of forbiddenPaths) {
      const response = await requestRaw(baseUrl, requestPath);
      assert.ok(response.status >= 400 && response.status < 500, `${requestPath} deve continuar inacessível (status ${response.status})`);
    }

    const traversalPaths = [
      "/../package.json",
      "/src/core/%2e%2e/%2e%2e/package.json",
      "/public/%2e%2e/%2e%2e/package.json",
      "/%252e%252e%252fpackage.json",
      "http://outside.example/package.json"
    ];
    for (const requestPath of traversalPaths) {
      const response = await requestRaw(baseUrl, requestPath);
      assert.ok(response.status >= 400 && response.status < 500, `tentativa externa/traversal ${requestPath} bloqueada (status ${response.status})`);
    }

    const head = await requestRaw(baseUrl, "/style.css", "HEAD");
    assert.equal(head.status, 200, "HEAD permite checagem de asset sem enviar corpo");
    assert.equal(head.body.length, 0);

    console.log(`✓ HTTP: raiz, CSS, ${scriptReferences.length} módulos JS e assets públicos carregados; referências locais sem 404`);
    console.log(`✓ Segurança HTTP: configurações, testes internos, caminhos ausentes, traversal e URI externa bloqueados; HEAD permitido`);
  } finally {
    child.kill("SIGTERM");
  }
})().catch((error) => {
  console.error(`✗ teste HTTP do servidor: ${error.stack || error}`);
  process.exitCode = 1;
});
