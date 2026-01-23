import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import qiankun from "vite-plugin-qiankun";

const packageName = "dip-for-talent";

export default defineConfig(({ mode} ) => ({
  plugins: [
    react(),
    qiankun(packageName, {
      useDevMode: mode === "development"
    })
  ],
  base: "/dip-for-talent/",
}));

