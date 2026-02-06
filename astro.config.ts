import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import astroCompress from "gab-astro-compress";

import mdx from "@astrojs/mdx";

export default defineConfig({
  output: "server",
  adapter: vercel({
    isr: true,
    imageService: true,
    webAnalytics: {
      enabled: true,
    },
  }),
  site: "https://www.rayhanadev.com",
  integrations: [sitemap(), astroCompress(), mdx()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "load",
  },
  devToolbar: {
    enabled: false,
  },
  build: {
    assets: "static",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  experimental: {
    clientPrerender: true,
    fonts: [
      {
        provider: fontProviders.fontshare(),
        name: "General Sans",
        cssVariable: "--font-general-sans",
      },
    ],
  },
});
