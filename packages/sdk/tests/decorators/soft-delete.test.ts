import { describe, it, expect, beforeEach } from "vitest";
import { getRegistry } from "../../src/metadata/registry.js";
import { Collection } from "../../src/decorators/collection.js";
import { SoftDelete } from "../../src/decorators/soft-delete.js";

describe("@SoftDelete decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("marks a collection for soft delete", () => {
    @SoftDelete
    @Collection("users")
    class User {}

    const meta = getRegistry().getCollection(User)!;
    expect(meta.softDelete).toBe(true);
  });

  it("defaults to false without decorator", () => {
    @Collection("users")
    class User {}

    const meta = getRegistry().getCollection(User)!;
    expect(meta.softDelete).toBe(false);
  });
});
