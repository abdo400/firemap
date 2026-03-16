// @firemap/sdk - Type-safe Firestore ODM
// Define your data model once. Firemap generates the rest.

export { Collection } from "./decorators/collection.js";
export type { CollectionOptions } from "./decorators/collection.js";
export { Field, Required } from "./decorators/field.js";
export type { FieldOptions } from "./decorators/field.js";
export { SoftDelete } from "./decorators/soft-delete.js";
export { DenormalizedFrom, SyncTo } from "./decorators/denormalization.js";
export { Index } from "./decorators/index-decorator.js";
export {
  Rules,
  AuthOwner,
  AuthRequired,
  PublicRead,
} from "./decorators/rules.js";

export { BaseModel, initializeFiremap } from "./model/base-model.js";
export type { FindOptions, WhereClause, OrderByClause } from "./model/base-model.js";

export { FiremapError, FiremapValidationError } from "./validation/errors.js";

export { getRegistry } from "./metadata/registry.js";

export type {
  FieldType,
  FieldMetadata,
  CollectionMetadata,
  DenormalizationSource,
  SyncTarget,
  IndexSpec,
  RulesSpec,
  IdStrategy,
  PrefillConfig,
} from "@firemap/shared";
