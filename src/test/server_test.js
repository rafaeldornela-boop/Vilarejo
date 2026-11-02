"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

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

(async () => {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, "../../server.js")], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: "ignore"
  });
  try {
    await waitForServer(baseUrl, child);
    const css = await fetch(`${baseUrl}/style.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type"), /^text\/css\b/);
    assert.match(await css.text(), /\.politics-dashboard/);

    const services = await fetch(`${baseUrl}/src/services/vilarejo_services.js`);
    assert.equal(services.status, 200);
    assert.match(services.headers.get("content-type"), /^text\/javascript\b/);

    const privateFile = await fetch(`${baseUrl}/package.json`);
    assert.equal(privateFile.status, 404);
    console.log("✓ servidor HTTP entrega CSS e módulos e bloqueia arquivos privados da raiz");
  } finally {
    child.kill("SIGTERM");
  }
})().catch((error) => {
  console.error(`✗ teste HTTP do servidor: ${error.stack || error}`);
  process.exitCode = 1;
});
