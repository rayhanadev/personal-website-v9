import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

import tailwindcss from "@tailwindcss/vite";

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
  redirects: {
    "/resume": "/resume.pdf",
    "/contact": "/contact.vcf",
    "/rss.xml": "https://rayhanadev.substack.com/feed",
    "/blog": "https://substack.com/@rayhanadev",
  },
  integrations: [sitemap()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "load",
  },
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        external: ["react-grab"],
      }
    }
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
