import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    title: "TurfTrack",
    description: "TurfTrack Documentation",
    base: "/TurfTrack/",
    publicDir: "docs/.vitepress/public",
    themeConfig: {
      logo: { src: "/logo.png", alt: "TurfTrack Logo" },
      nav: [
        { text: "Home", link: "/" },
        { text: "GitHub", link: "https://github.com/RunOnYourOwn/TurfTrack" },
      ],
      sidebar: [
        {
          text: "Introduction",
          items: [{ text: "What is TurfTrack?", link: "/introduction" }],
        },
        {
          text: "Architecture",
          items: [
            { text: "System Diagram", link: "/architecture" },
            { text: "Technical Details", link: "/technical" },
          ],
        },
        {
          text: "Development",
          items: [],
        },
        {
          text: "User Guide",
          items: [
            { text: "Lawns", link: "/guide/lawns" },
            { text: "GDD Models", link: "/guide/gdd" },
            { text: "Products", link: "/guide/products" },
            { text: "Applications", link: "/guide/applications" },
            { text: "Reports", link: "/guide/reports" },
            { text: "Task Monitor", link: "/guide/task-monitor" },
          ],
        },
      ],
    },
  })
);
