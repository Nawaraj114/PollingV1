import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("FriendCircle web app manifest", () => {
  it("defines a same-origin standalone install experience", () => {
    const value = manifest();

    expect(value).toMatchObject({
      display: "standalone",
      id: "/",
      name: "FriendCircle",
      scope: "/",
      short_name: "FriendCircle",
      start_url: "/dashboard",
    });
  });

  it("provides required regular and maskable install icons", () => {
    const icons = manifest().icons ?? [];

    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          sizes: "512x512",
          type: "image/png",
        }),
        expect.objectContaining({
          purpose: "maskable",
          sizes: "512x512",
        }),
      ]),
    );
    expect(icons.every(({ src }) => src.startsWith("/"))).toBe(true);
  });

  it("keeps app shortcuts within the manifest scope", () => {
    const shortcuts = manifest().shortcuts ?? [];

    expect(shortcuts.map(({ url }) => url)).toEqual([
      "/bills",
      "/balances",
      "/polls",
    ]);
    expect(shortcuts.every(({ url }) => url.startsWith("/"))).toBe(true);
  });
});
