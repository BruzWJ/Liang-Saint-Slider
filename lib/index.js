/**
 * dsh-plugin-liang-calibrator — host half.
 *
 * Pure service half: serves the portrait keyframes (frame-00..frame-30.webp)
 * under `/liang-assets/` so the browser half never needs a CDN or a patched
 * static server. The UI itself lives in `./client` (see package.json
 * `dsh.client`).
 */
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Stable Cordis plugin name. */
const name = "liang-calibrator";
/** Services required before the asset route can be mounted. */
const inject = ["webServer"];

const MIME = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
};

/** The asset root this file owns: `<package>/lib/assets`. */
const assetsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "assets");

/**
 * Mount the asset route on the profile's web server.
 * @param ctx - host plugin context carrying the `webServer` service.
 */
function apply(ctx) {
  ctx.webServer.register({
    kind: "prefix",
    path: "/liang-assets",
    handler: async (req, res) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      /* v8 ignore next -- node:http always sets url on server requests. */
      const rawUrl = req.url ?? "/";
      if (rawUrl.includes("..")) {
        res.writeHead(403);
        res.end();
        return;
      }
      const rawPath = decodeURIComponent(new URL(rawUrl, "http://x").pathname);
      const rel = rawPath.slice("/liang-assets".length).replace(/^\/+/, "");
      const target = resolve(normalize(join(assetsRoot, rel)));
      if (target !== assetsRoot && !target.startsWith(assetsRoot + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        const body = await readFile(target);
        res.writeHead(200, {
          "content-type": MIME[extname(target)] ?? "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    },
  });
}

export { apply, inject, name };
