import type { FieldType } from "@firemap/shared";
import type { InternalFieldMetadata } from "../metadata/types.js";
import { FiremapValidationError } from "./errors.js";

/** Validate a value against its expected type */
function validateType(
  value: unknown,
  expectedType: FieldType,
  fieldName: string,
  collectionName: string,
): void {
  if (value === null || value === undefined) {
    return; // null/undefined is handled by required check
  }

  const typeChecks: Record<FieldType, (v: unknown) => boolean> = {
    string: (v) => typeof v === "string",
    number: (v) => typeof v === "number" && !Number.isNaN(v),
    boolean: (v) => typeof v === "boolean",
    timestamp: (v) =>
      v instanceof Date ||
      (typeof v === "object" &&
        v !== null &&
        "toDate" in v &&
        typeof (v as Record<string, unknown>).toDate === "function"),
    geopoint: (v) =>
      typeof v === "object" &&
      v !== null &&
      "latitude" in v &&
      "longitude" in v,
    reference: (v) =>
      typeof v === "object" && v !== null && "path" in v,
    array: (v) => Array.isArray(v),
    map: (v) =>
      typeof v === "object" && v !== null && !Array.isArray(v),
    bytes: (v) =>
      v instanceof Uint8Array ||
      (typeof v === "object" && v !== null && "toUint8Array" in v),
  };

  const check = typeChecks[expectedType];
  if (check && !check(value)) {
    throw new FiremapValidationError(
      "TYPE_MISMATCH",
      `Field '${fieldName}' in '${collectionName}' expected type '${expectedType}', got '${typeof value}'`,
      {
        collection: collectionName,
        field: fieldName,
        expectedType,
        receivedType: typeof value,
      },
    );
  }
}

/** Validate data for a create operation (all required fields must be present) */
export function validateCreate(
  data: Record<string, unknown>,
  fields: Map<string, InternalFieldMetadata>,
  collectionName: string,
): void {
  // Check required fields
  for (const [fieldName, meta] of fields) {
    if (meta.required && !(fieldName in data)) {
      throw new FiremapValidationError(
        "REQUIRED_FIELD",
        `Field '${fieldName}' is required in '${collectionName}'`,
        {
          collection: collectionName,
          field: fieldName,
          suggestion: `Include '${fieldName}' in the data object`,
        },
      );
    }
  }

  // Validate types for provided fields
  for (const [key, value] of Object.entries(data)) {
    const meta = fields.get(key);
    if (meta) {
      validateType(value, meta.type, key, collectionName);
    }
  }
}

/** Validate data for an update operation (only validate provided fields) */
export function validateUpdate(
  data: Record<string, unknown>,
  fields: Map<string, InternalFieldMetadata>,
  collectionName: string,
): void {
  for (const [key, value] of Object.entries(data)) {
    const meta = fields.get(key);
    if (meta) {
      validateType(value, meta.type, key, collectionName);
    }
  }
}
