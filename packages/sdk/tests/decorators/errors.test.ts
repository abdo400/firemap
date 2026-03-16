import { describe, it, expect } from "vitest";
import {
  FiremapError,
  FiremapValidationError,
} from "../../src/validation/errors.js";

describe("FiremapError", () => {
  it("has correct properties", () => {
    const err = new FiremapError("TEST_CODE", "Test message", {
      collection: "users",
      field: "name",
      suggestion: "Do something",
    });

    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("Test message");
    expect(err.name).toBe("FiremapError");
    expect(err.details?.collection).toBe("users");
    expect(err.details?.field).toBe("name");
    expect(err.details?.suggestion).toBe("Do something");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("FiremapValidationError", () => {
  it("extends FiremapError", () => {
    const err = new FiremapValidationError(
      "REQUIRED_FIELD",
      "Field required",
    );

    expect(err).toBeInstanceOf(FiremapError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("FiremapValidationError");
  });
});
