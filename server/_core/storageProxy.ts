import type { Express } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { ENV } from "./env";

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), ".local-storage");

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      if (ENV.isProduction) {
        res.status(500).send("Storage proxy not configured");
        return;
      }
      const filePath = path.resolve(LOCAL_STORAGE_DIR, key);
      if (!filePath.startsWith(`${LOCAL_STORAGE_DIR}${path.sep}`)) {
        res.status(400).send("Invalid storage key");
        return;
      }
      try {
        res.sendFile(filePath, error => {
          if (error && !res.headersSent) res.status(404).send("Storage file not found");
        });
      } catch {
        if (!res.headersSent) res.status(404).send("Storage file not found");
      }
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
