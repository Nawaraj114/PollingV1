import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function publicAsset(path: string) {
  return resolve(process.cwd(), "public", path);
}

function pngDimensions(path: string) {
  const image = readFileSync(publicAsset(path));

  expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    height: image.readUInt32BE(20),
    width: image.readUInt32BE(16),
  };
}

describe("PWA assets", () => {
  it.each([
    ["icons/friendcircle-192.png", 192],
    ["icons/friendcircle-512.png", 512],
    ["icons/friendcircle-maskable-512.png", 512],
    ["icons/friendcircle-apple-180.png", 180],
  ])("ships %s at the declared dimensions", (path, size) => {
    expect(pngDimensions(path)).toEqual({ height: size, width: size });
  });

  it("keeps private application responses out of service-worker caches", () => {
    const serviceWorker = readFileSync(publicAsset("sw.js"), "utf8");

    expect(serviceWorker).toContain('event.request.mode !== "navigate"');
    expect(serviceWorker).toContain('const OFFLINE_URL = "/offline.html"');
    expect(serviceWorker).not.toContain("cache.put");
    expect(serviceWorker).not.toContain("caches.match(event.request)");
    expect(serviceWorker).not.toContain("/api/");
    expect(serviceWorker).toContain(
      'key.startsWith("friendcircle-shell-")',
    );
  });

  it("provides a self-contained offline explanation", () => {
    const offlinePage = readFileSync(publicAsset("offline.html"), "utf8");

    expect(offlinePage).toContain("<title>FriendCircle is offline</title>");
    expect(offlinePage).toContain("needs an internet connection");
    expect(offlinePage).not.toMatch(/<script/iu);
  });
});
