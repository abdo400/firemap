/** Schema format used for interchange between SDK, CLI, and web platform */
export interface SchemaDefinition {
  version: number;
  collections: SchemaCollection[];
}

export interface SchemaCollection {
  name: string;
  fields: SchemaField[];
  indexes: SchemaIndex[];
  rules?: SchemaRules;
  relationships: SchemaRelationship[];
}

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: unknown;
  nested?: SchemaField[];
}

export interface SchemaIndex {
  fields: Array<{
    fieldPath: string;
    order: "ASCENDING" | "DESCENDING";
  }>;
}

export interface SchemaRules {
  read?: string;
  write?: string;
  create?: string;
  update?: string;
  delete?: string;
}

export interface SchemaRelationship {
  type: "reference" | "denormalization" | "sync";
  sourceCollection: string;
  targetCollection: string;
  sourceField: string;
  targetField: string;
}
