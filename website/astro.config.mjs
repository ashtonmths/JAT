// The project's website: one landing page (src/pages/index.astro), served by GitHub Pages.
// The docs stay on GitHub (docs/guide); the page links to them. The redesign is built at /preview/
// (docs/rfc/website-redesign.md §11): noindex, and left out of the sitemap until it replaces the homepage.
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://waddington.github.io",
  base: "/job-application-tracker",
  trailingSlash: "always",
  integrations: [sitemap({ filter: (page) => !page.includes("/preview/") })],
});
