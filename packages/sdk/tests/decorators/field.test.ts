import { describe, it, expect, beforeEach } from "vitest";
import { getRegistry } from "../../src/metadata/registry.js";
import { Collection } from "../../src/decorators/collection.js";
import { Field, Required } from "../../src/decorators/field.js";

describe("@Field decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("registers a basic field", () => {
    @Collection("users")
    class User {
      @Field({ type: "string" })
      name!: string;
    }

    new User(); // trigger initializers
    const meta = getRegistry().getCollection(User)!;
    const field = meta.fields.get("name");
    expect(field).toBeDefined();
    expect(field!.type).toBe("string");
    expect(field!.required).toBe(false);
  });

  it("registers a required field", () => {
    @Collection("users")
    class User {
      @Field({ type: "string", required: true })
      name!: string;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.fields.get("name")!.required).toBe(true);
  });

  it("registers a field with default value", () => {
    @Collection("users")
    class User {
      @Field({ type: "number", default: 0 })
      score!: number;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.fields.get("score")!.defaultValue).toBe(0);
  });

  it("registers a field with description", () => {
    @Collection("users")
    class User {
      @Field({ type: "string", description: "User display name" })
      name!: string;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.fields.get("name")!.description).toBe("User display name");
  });

  it("registers a field with indexed flag", () => {
    @Collection("users")
    class User {
      @Field({ type: "string", indexed: true })
      email!: string;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.fields.get("email")!.indexed).toBe(true);
  });

  it("registers an array field with element type", () => {
    @Collection("users")
    class User {
      @Field({ type: "array", arrayElementType: "string" })
      tags!: string[];
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.fields.get("tags")!.arrayElementType).toBe("string");
  });

  it("registers a field with prefill config", () => {
    @Collection("users")
    class User {
      @Field({
        type: "string",
        prefill: { enabled: true, mode: "value", value: "N/A" },
      })
      nickname!: string;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    const field = meta.fields.get("nickname")!;
    expect(field.prefill).toEqual({
      enabled: true,
      mode: "value",
      value: "N/A",
    });
  });

  it("registers a field with null-mode prefill", () => {
    @Collection("users")
    class User {
      @Field({
        type: "string",
        prefill: { enabled: true, mode: "null" },
      })
      bio!: string;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.fields.get("bio")!.prefill!.mode).toBe("null");
  });

  it("registers multiple fields", () => {
    @Collection("users")
    class User {
      @Field({ type: "string", required: true })
      name!: string;

      @Field({ type: "string", required: true })
      email!: string;

      @Field({ type: "number" })
      age!: number;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.fields.size).toBe(3);
  });

  it("handles all field types", () => {
    const types = [
      "string",
      "number",
      "boolean",
      "timestamp",
      "geopoint",
      "reference",
      "array",
      "map",
      "bytes",
    ] as const;

    for (const type of types) {
      getRegistry().clear();

      @Collection("test")
      class TestModel {
        @Field({ type })
        field!: unknown;
      }

      new TestModel();
      const meta = getRegistry().getCollection(TestModel)!;
      expect(meta.fields.get("field")!.type).toBe(type);
    }
  });
});

describe("@Required decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("marks a field as required when combined with @Field", () => {
    @Collection("users")
    class User {
      @Required
      @Field({ type: "string" })
      email!: string;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.fields.get("email")!.required).toBe(true);
  });
});
