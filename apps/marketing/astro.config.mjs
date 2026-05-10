import { defineConfig } from "astro/config";

export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  server: {
    port: Number(process.env.PORT ?? 4173),
  },
});
