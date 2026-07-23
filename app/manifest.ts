import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f4f5f7",
    categories: ["finance", "social", "productivity"],
    description:
      "A private place for friends to run polls, split bills, and verify payments.",
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/icons/friendcircle-192.png",
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: "/icons/friendcircle-512.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icons/friendcircle-maskable-512.png",
        type: "image/png",
      },
    ],
    id: "/",
    lang: "en",
    name: "FriendCircle",
    orientation: "any",
    scope: "/",
    short_name: "FriendCircle",
    shortcuts: [
      {
        description: "Review bills and payment actions",
        name: "Bills",
        short_name: "Bills",
        url: "/bills",
      },
      {
        description: "Review balances and mark payments",
        name: "Balances",
        short_name: "Balances",
        url: "/balances",
      },
      {
        description: "Vote in open circle polls",
        name: "Polls",
        short_name: "Polls",
        url: "/polls",
      },
    ],
    start_url: "/dashboard",
    theme_color: "#1473e6",
  };
}
