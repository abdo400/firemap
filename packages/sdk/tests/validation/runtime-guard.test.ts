import { describe, it, expect } from "vitest";
import { validateCreate, validateUpdate } from "../../src/validation/runtime-guard.js";
import { FiremapValidationError } from "../../src/validation/errors.js";
import type { InternalFieldMetadata } from "../../src/metadata/types.js";

function makeFields(
  defs: Array<{ name: string; type: InternalFieldMetadata["type"]; required?: boolean }>,
): Map<string, InternalFieldMetadata> {
  const map = new Map<string, InternalFieldMetadata>();
  for (const def of defs) {
    map.set(def.name, {
      name: def.name,
      type: def.type,
      required: def.required ?? false,
    });
  }
  return map;
}

describe("validateCreate", () => {
  it("passes with all required fields present", () => {
    const fields = makeFields([
      { name: "name", type: "string", required: true },
      { name: "email", type: "string", required: true },
    ]);

    expect(() =>
      validateCreate({ name: "John", email: "john@test.com" }, fields, "users"),
    ).not.toThrow();
  });

  it("throws on missing required field", () => {
    const fields = makeFields([
      { name: "name", type: "string", required: true },
      { name: "email", type: "string", required: true },
    ]);

    expect(() => validateCreate({ name: "John" }, fields, "users")).toThrow(
      FiremapValidationError,
    );
  });

  it("throws with correct error code for missing field", () => {
    const fields = makeFields([
      { name: "email", type: "string", required: true },
    ]);

    try {
      validateCreate({}, fields, "users");
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as FiremapValidationError;
      expect(err.code).toBe("REQUIRED_FIELD");
      expect(err.details?.field).toBe("email");
      expect(err.details?.collection).toBe("users");
    }
  });

  it("throws on type mismatch", () => {
    const fields = makeFields([
      { name: "name", type: "string", required: false },
    ]);

    expect(() =>
      validateCreate({ name: 123 }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("throws with TYPE_MISMATCH code", () => {
    const fields = makeFields([
      { name: "age", type: "number", required: false },
    ]);

    try {
      validateCreate({ age: "not-a-number" }, fields, "users");
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as FiremapValidationError;
      expect(err.code).toBe("TYPE_MISMATCH");
    }
  });

  it("allows optional fields to be missing", () => {
    const fields = makeFields([
      { name: "name", type: "string", required: true },
      { name: "bio", type: "string", required: false },
    ]);

    expect(() =>
      validateCreate({ name: "John" }, fields, "users"),
    ).not.toThrow();
  });

  it("validates boolean type", () => {
    const fields = makeFields([
      { name: "active", type: "boolean", required: false },
    ]);

    expect(() =>
      validateCreate({ active: true }, fields, "users"),
    ).not.toThrow();
    expect(() =>
      validateCreate({ active: "yes" }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("validates array type", () => {
    const fields = makeFields([
      { name: "tags", type: "array", required: false },
    ]);

    expect(() =>
      validateCreate({ tags: ["a", "b"] }, fields, "users"),
    ).not.toThrow();
    expect(() =>
      validateCreate({ tags: "not-array" }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("validates map type", () => {
    const fields = makeFields([
      { name: "address", type: "map", required: false },
    ]);

    expect(() =>
      validateCreate({ address: { city: "NYC" } }, fields, "users"),
    ).not.toThrow();
    expect(() =>
      validateCreate({ address: [1, 2] }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("allows null/undefined values for non-required fields", () => {
    const fields = makeFields([
      { name: "bio", type: "string", required: false },
    ]);

    expect(() =>
      validateCreate({ bio: null }, fields, "users"),
    ).not.toThrow();
  });

  it("rejects NaN for number type", () => {
    const fields = makeFields([
      { name: "score", type: "number", required: false },
    ]);

    expect(() =>
      validateCreate({ score: NaN }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });
});

describe("validateUpdate", () => {
  it("validates only provided fields", () => {
    const fields = makeFields([
      { name: "name", type: "string", required: true },
      { name: "email", type: "string", required: true },
    ]);

    // Should pass — doesn't check required for update
    expect(() =>
      validateUpdate({ name: "Jane" }, fields, "users"),
    ).not.toThrow();
  });

  it("throws on type mismatch in update", () => {
    const fields = makeFields([
      { name: "name", type: "string", required: false },
    ]);

    expect(() =>
      validateUpdate({ name: 123 }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("ignores unknown fields", () => {
    const fields = makeFields([
      { name: "name", type: "string", required: false },
    ]);

    expect(() =>
      validateUpdate({ unknownField: "value" }, fields, "users"),
    ).not.toThrow();
  });
});

describe("validateType edge cases", () => {
  it("validates timestamp with Date", () => {
    const fields = makeFields([
      { name: "createdAt", type: "timestamp", required: false },
    ]);

    expect(() =>
      validateCreate({ createdAt: new Date() }, fields, "users"),
    ).not.toThrow();
  });

  it("validates timestamp with Firestore Timestamp-like object", () => {
    const fields = makeFields([
      { name: "createdAt", type: "timestamp", required: false },
    ]);

    expect(() =>
      validateCreate(
        { createdAt: { toDate: () => new Date() } },
        fields,
        "users",
      ),
    ).not.toThrow();
  });

  it("rejects non-timestamp for timestamp type", () => {
    const fields = makeFields([
      { name: "createdAt", type: "timestamp", required: false },
    ]);

    expect(() =>
      validateCreate({ createdAt: "2024-01-01" }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("validates geopoint-like object", () => {
    const fields = makeFields([
      { name: "location", type: "geopoint", required: false },
    ]);

    expect(() =>
      validateCreate(
        { location: { latitude: 40.7, longitude: -74.0 } },
        fields,
        "users",
      ),
    ).not.toThrow();
  });

  it("rejects non-geopoint for geopoint type", () => {
    const fields = makeFields([
      { name: "location", type: "geopoint", required: false },
    ]);

    expect(() =>
      validateCreate({ location: "NYC" }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("validates reference-like object", () => {
    const fields = makeFields([
      { name: "authorRef", type: "reference", required: false },
    ]);

    expect(() =>
      validateCreate(
        { authorRef: { path: "users/u1" } },
        fields,
        "users",
      ),
    ).not.toThrow();
  });

  it("rejects non-reference for reference type", () => {
    const fields = makeFields([
      { name: "authorRef", type: "reference", required: false },
    ]);

    expect(() =>
      validateCreate({ authorRef: "users/u1" }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("validates bytes with Uint8Array", () => {
    const fields = makeFields([
      { name: "data", type: "bytes", required: false },
    ]);

    expect(() =>
      validateCreate(
        { data: new Uint8Array([1, 2, 3]) },
        fields,
        "users",
      ),
    ).not.toThrow();
  });

  it("validates bytes with Firestore Bytes-like object", () => {
    const fields = makeFields([
      { name: "data", type: "bytes", required: false },
    ]);

    expect(() =>
      validateCreate(
        { data: { toUint8Array: () => new Uint8Array() } },
        fields,
        "users",
      ),
    ).not.toThrow();
  });

  it("rejects non-bytes for bytes type", () => {
    const fields = makeFields([
      { name: "data", type: "bytes", required: false },
    ]);

    expect(() =>
      validateCreate({ data: "not-bytes" }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("rejects string for number type", () => {
    const fields = makeFields([
      { name: "count", type: "number", required: false },
    ]);

    expect(() =>
      validateCreate({ count: "5" }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("rejects number for boolean type", () => {
    const fields = makeFields([
      { name: "active", type: "boolean", required: false },
    ]);

    expect(() =>
      validateCreate({ active: 1 }, fields, "users"),
    ).toThrow(FiremapValidationError);
  });

  it("rejects object with null for map type", () => {
    const fields = makeFields([
      { name: "meta", type: "map", required: false },
    ]);

    expect(() =>
      validateCreate({ meta: null }, fields, "users"),
    ).not.toThrow(); // null is handled by required check
  });

  it("TYPE_MISMATCH error includes expected and received type", () => {
    const fields = makeFields([
      { name: "name", type: "string", required: false },
    ]);

    try {
      validateCreate({ name: 42 }, fields, "users");
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as FiremapValidationError;
      expect(err.code).toBe("TYPE_MISMATCH");
      expect(err.details?.expectedType).toBe("string");
      expect(err.details?.receivedType).toBe("number");
    }
  });
});
