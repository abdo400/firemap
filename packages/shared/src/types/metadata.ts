/** Field type identifiers supported by Firemap */
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "geopoint"
  | "reference"
  | "array"
  | "map"
  | "bytes";

/** Document ID generation strategy */
export type IdStrategy = "auto" | "assigned";

/** Prefill configuration for existing documents */
export interface PrefillConfig {
  enabled: boolean;
  mode: "null" | "value";
  value?: string;
}

/** Metadata for a single field in a collection */
export interface FieldMetadata {
  name: string;
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
  /** Description/documentation for the field */
  description?: string;
  /** Whether this field should be indexed */
  indexed?: boolean;
  /** Nested fields for map type (recursive) */
  nestedFields?: FieldMetadata[];
  /** Element type for array fields */
  arrayElementType?: FieldType;
  /** Prefill configuration for backfilling existing documents */
  prefill?: PrefillConfig;
}

/** Denormalization source metadata */
export interface DenormalizationSource {
  sourceCollection: string;
  fields: string[];
}

/** Sync target metadata */
export interface SyncTarget {
  targetCollection: string;
  field: string;
  sourceField: string;
}

/** Index specification */
export interface IndexSpec {
  fields: Array<{
    fieldPath: string;
    order: "ASCENDING" | "DESCENDING";
  }>;
}

/** Rules specification per operation */
export interface RulesSpec {
  read?: string;
  write?: string;
  create?: string;
  update?: string;
  delete?: string;
}

/** Complete collection metadata */
export interface CollectionMetadata {
  collectionName: string;
  className: string;
  fields: FieldMetadata[];
  indexes: IndexSpec[];
  rules?: RulesSpec;
  denormalizationSources: DenormalizationSource[];
  syncTargets: SyncTarget[];
  softDelete: boolean;
  /** Document ID generation strategy */
  idStrategy?: IdStrategy;
  /** Parent collection path for subcollections */
  parentCollection?: string;
}
