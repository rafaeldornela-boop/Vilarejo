"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname);
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return { error: 400 };
  }

  if (pathname.includes("\\") || pathname.includes("\0")) return { error: 400 };
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const segments = relativePath.split(/[\\/]/);
  if (segments.some((segment) => segment.startsWith("."))) return { error: 404 };
  const allowedRootFiles = new Set(["index.html", "script.js", "eventos_v3.js", "vilarejo_core.js"]);
  if (!allowedRootFiles.has(relativePath) && !relativePath.startsWith("public/")) return { error: 404 };

  const filePath = path.resolve(ROOT, relativePath);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) return { error: 403 };
  return { filePath };
}

function sendText(response, status, message) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  response.end(message);
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendText(response, 405, "Método não permitido");
    return;
  }

  const resolved = resolveRequestPath(request.url || "/");
  if (resolved.error) {
    sendText(response, resolved.error, resolved.error === 403 ? "Acesso negado" : "Arquivo não encontrado");
    return;
  }

  fs.stat(resolved.filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendText(response, 404, "Arquivo não encontrado");
      return;
    }

    const contentType = MIME_TYPES[path.extname(resolved.filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const stream = fs.createReadStream(resolved.filePath);
    stream.on("error", () => {
      if (!response.headersSent) sendText(response, 500, "Erro ao ler o arquivo");
      else response.destroy();
    });
    stream.pipe(response);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Vilarejo disponível em http://${HOST}:${PORT}`);
});

server.on("error", (error) => {
  console.error(`Não foi possível iniciar o servidor: ${error.message}`);
  process.exitCode = 1;
});
