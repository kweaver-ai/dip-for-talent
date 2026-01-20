import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import qiankun from "vite-plugin-qiankun";

const packageName = "dip-for-talent";

export default defineConfig({
  plugins: [
    react(),
    qiankun(packageName, {
      useDevMode: true
    })
  ],
  base: "/dip-for-talent/",
  server: {
    port: 8081,
    cors: true,
    proxy: {
      "/api": {
        target: "https://dip.aishu.cn/",
        changeOrigin: true
      }
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "X-Requested-With, content-type, Authorization"
    }
  }
});

