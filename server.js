"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = fs.realpathSync(__dirname);
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".bmp": "image/bmp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf"
};

// index.html e style.css são os únicos arquivos permitidos na raiz.
const allowedRootFiles = new Set(["index.html", "style.css"]);
const RUNTIME_SRC_DIRS = new Set([
  "core", "economy", "events", "institutions", "intelligence", "newspaper", "politics", "services", "shared", "society", "ui", "world"
]);
const PUBLIC_ASSET_EXTENSIONS = new Set([
  ".avif", ".bmp", ".css", ".gif", ".ico", ".jpeg", ".jpg", ".mp3", ".m4a", ".ogg", ".png",
  ".svg", ".wav", ".webm", ".webp", ".mp4", ".aac", ".otf", ".ttf", ".woff", ".woff2"
]);
const BLOCKED_FILE_PATTERNS = [
  /^\.env(?:\..*)?$/i,
  /^package(?:-lock)?\.json$/i,
  /^npm-shrinkwrap\.json$/i,
  /^(?:yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/i,
  /^tsconfig(?:\..*)?\.json$/i,
  /^(?:vite|webpack|rollup|eslint|postcss|tailwind|babel|jest|vitest)\.config\./i,
  /\.config\.(?:[cm]?js|json|ts|ya?ml)$/i,
  /(?:^|[._-])config(?:uration)?(?:[._-]|$)/i,
  /\.(?:map|log|bak|old|orig|swp|tmp)$/i
];

function isAllowedRelativePath(relativePath) {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\")) return false;
  const segments = relativePath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.startsWith("."))) return false;
  const basename = segments[segments.length - 1];
  if (BLOCKED_FILE_PATTERNS.some((pattern) => pattern.test(basename))) return false;

  if (allowedRootFiles.has(relativePath)) return true;

  if (segments[0] === "src") {
    if (segments.length < 3 || !RUNTIME_SRC_DIRS.has(segments[1])) return false;
    return path.posix.extname(relativePath).toLowerCase() === ".js";
  }

  if (segments[0] === "public") {
    if (segments.length < 2) return false;
    return PUBLIC_ASSET_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
  }

  return false;
}

function resolveRequestPath(requestTarget) {
  const delimiter = requestTarget.search(/[?#]/);
  const rawPath = delimiter === -1 ? requestTarget : requestTarget.slice(0, delimiter);
  if (!rawPath.startsWith("/") || rawPath.startsWith("//")) return { error: 400 };

  let pathname;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    return { error: 400 };
  }

  if (pathname.includes("\\") || pathname.includes("\0") || pathname.startsWith("//")) return { error: 400 };
  if (pathname === "/") pathname = "/index.html";
  const relativePath = pathname.slice(1);
  if (!isAllowedRelativePath(relativePath)) return { error: 404 };

  const filePath = path.resolve(ROOT, relativePath);
  const relativeToRoot = path.relative(ROOT, filePath);
  if (!relativeToRoot || relativeToRoot === ".." || relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
    return { error: 403 };
  }
  return { filePath, relativePath };
}

function isInsideRoot(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
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

  fs.realpath(resolved.filePath, (realpathError, realPath) => {
    if (realpathError || !isInsideRoot(realPath)) {
      sendText(response, 404, "Arquivo não encontrado");
      return;
    }
    const actualRelativePath = path.relative(ROOT, realPath).split(path.sep).join("/");
    if (!isAllowedRelativePath(actualRelativePath) || path.posix.extname(actualRelativePath).toLowerCase() !== path.posix.extname(resolved.relativePath).toLowerCase()) {
      sendText(response, 404, "Arquivo não encontrado");
      return;
    }

    fs.stat(realPath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        sendText(response, 404, "Arquivo não encontrado");
        return;
      }

      const contentType = MIME_TYPES[path.extname(actualRelativePath).toLowerCase()];
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

      const stream = fs.createReadStream(realPath);
      stream.on("error", () => {
        if (!response.headersSent) sendText(response, 500, "Erro ao ler o arquivo");
        else response.destroy();
      });
      stream.pipe(response);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Vilarejo disponível em http://${HOST}:${PORT}`);
});

server.on("error", (error) => {
  console.error(`Não foi possível iniciar o servidor: ${error.message}`);
  process.exitCode = 1;
});
