import type {
  FieldMetadata,
  FieldType,
  IdStrategy,
  IndexSpec,
  PrefillConfig,
  RulesSpec,
  DenormalizationSource,
  SyncTarget,
} from "@firemap/shared";

/** Constructor type used as decorator target / map key */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor = abstract new (...args: any[]) => any;

/** Internal collection metadata stored in the registry */
export interface InternalCollectionMetadata {
  collectionName: string;
  target: Constructor;
  fields: Map<string, InternalFieldMetadata>;
  indexes: IndexSpec[];
  rules?: RulesSpec;
  denormalizationSources: Map<string, DenormalizationSource>;
  syncTargets: SyncTarget[];
  softDelete: boolean;
  /** Document ID generation strategy */
  idStrategy?: IdStrategy;
  /** Parent collection path for subcollections */
  parentCollection?: string;
}

/** Internal field metadata with mutable state */
export interface InternalFieldMetadata {
  name: string;
  type: FieldMetadata["type"];
  required: boolean;
  defaultValue?: unknown;
  nestedType?: Constructor;
  /** Description/documentation for the field */
  description?: string;
  /** Whether this field should be indexed */
  indexed?: boolean;
  /** Element type for array fields */
  arrayElementType?: FieldType;
  /** Prefill configuration for backfilling existing documents */
  prefill?: PrefillConfig;
}
