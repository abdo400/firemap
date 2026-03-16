import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "../src/types/config.js";

describe("config", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_CONFIG.models).toEqual(["src/models/**/*.ts"]);
    expect(DEFAULT_CONFIG.outDir).toBe("./generated");
    expect(DEFAULT_CONFIG.chunkSize).toBe(400);
  });
});
