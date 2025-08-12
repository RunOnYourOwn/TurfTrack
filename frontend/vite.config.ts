import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor libraries into their own chunk
          vendor: ["react", "react-dom", "react-router-dom"],
          // Separate UI components into their own chunk
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-progress",
          ],
        },
      },
    },
    // Increase chunk size warning limit since we're using manual chunks
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://api:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
