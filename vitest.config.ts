import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Tests unitarios de la lógica pura (sin DB ni Next). Alias @ -> src.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
