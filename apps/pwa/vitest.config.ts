import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";
import { sharedAliases } from "./vite.config";

export default defineProject({
  plugins: [react()],
  resolve: { alias: sharedAliases },
  test: {
    name: "pwa",
    root: import.meta.dirname,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-test-key",
    },
  },
});
