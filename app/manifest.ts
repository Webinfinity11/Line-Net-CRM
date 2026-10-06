import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Line Net CRM",
    short_name: "Line Net",
    description: "შეკვეთების მართვის სისტემა",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#397b83",
    lang: "ka",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
