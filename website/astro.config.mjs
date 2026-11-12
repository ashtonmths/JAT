// The project's website: one landing page (src/pages/index.astro), served by GitHub Pages.
// The docs stay on GitHub (docs/guide); the page links to them. /preview/ (where the redesign was built) only
// redirects to the page, so it's left out of the sitemap.
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://waddington.github.io",
  base: "/job-application-tracker",
  trailingSlash: "always",
  integrations: [
    sitemap({ filter: (page) => new URL(page).pathname !== "/job-application-tracker/preview/" }),
  ],
});
