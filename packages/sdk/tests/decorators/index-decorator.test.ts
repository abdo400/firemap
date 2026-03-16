import { describe, it, expect, beforeEach } from "vitest";
import { getRegistry } from "../../src/metadata/registry.js";
import { Collection } from "../../src/decorators/collection.js";
import { Index } from "../../src/decorators/index-decorator.js";

describe("@Index decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("registers a composite index", () => {
    @Index(["userId", "createdAt"])
    @Collection("tasks")
    class Task {}

    const meta = getRegistry().getCollection(Task)!;
    expect(meta.indexes).toHaveLength(1);
    expect(meta.indexes[0]!.fields).toEqual([
      { fieldPath: "userId", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "ASCENDING" },
    ]);
  });

  it("applies DESCENDING order to last field when specified", () => {
    @Index(["status", "updatedAt"], { order: "DESCENDING" })
    @Collection("tasks")
    class Task {}

    const meta = getRegistry().getCollection(Task)!;
    expect(meta.indexes[0]!.fields[0]!.order).toBe("ASCENDING");
    expect(meta.indexes[0]!.fields[1]!.order).toBe("DESCENDING");
  });

  it("registers multiple indexes", () => {
    @Index(["userId", "createdAt"])
    @Index(["status", "priority"])
    @Collection("tasks")
    class Task {}

    const meta = getRegistry().getCollection(Task)!;
    expect(meta.indexes).toHaveLength(2);
  });

  it("defaults all fields to ASCENDING", () => {
    @Index(["a", "b", "c"])
    @Collection("test")
    class Test {}

    const meta = getRegistry().getCollection(Test)!;
    for (const field of meta.indexes[0]!.fields) {
      expect(field.order).toBe("ASCENDING");
    }
  });
});
