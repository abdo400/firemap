import type {
  CollectionMetadata,
  DenormalizationSource,
  IdStrategy,
  SyncTarget,
  IndexSpec,
  RulesSpec,
} from "@firemap/shared";
import type {
  Constructor,
  InternalCollectionMetadata,
  InternalFieldMetadata,
} from "./types.js";

/** Queued action from field decorators, processed by @Collection */
interface QueuedAction {
  type: "registerField" | "markRequired" | "addDenormalizationSource" | "addSyncTarget";
  fieldName: string;
  fieldMetadata?: InternalFieldMetadata;
  denormSource?: DenormalizationSource;
  syncTarget?: SyncTarget;
}

/**
 * Global metadata registry for Firemap decorators.
 * Uses a Map keyed by class constructor for O(1) lookups.
 * Singleton pattern — the same registry is used across all modules.
 *
 * Field decorators (TC39 Stage 3) don't receive the class constructor,
 * so they queue their actions. The @Collection class decorator drains
 * the queue with the real constructor, enabling CLI usage without
 * needing to instantiate models.
 */
class MetadataRegistry {
  private collections = new Map<Constructor, InternalCollectionMetadata>();
  private pendingFields = new Map<Constructor, Map<string, InternalFieldMetadata>>();
  private actionQueue: QueuedAction[] = [];

  /** Queue a field action for the next @Collection class decorator to process */
  queueAction(action: QueuedAction): void {
    this.actionQueue.push(action);
  }

  /** Drain the action queue, applying all actions to the given class constructor */
  processQueue(target: Constructor): void {
    const actions = this.actionQueue.splice(0);
    for (const action of actions) {
      switch (action.type) {
        case "registerField":
          if (action.fieldMetadata) {
            this.registerField(target, action.fieldName, action.fieldMetadata);
          }
          break;
        case "markRequired":
          this.markRequired(target, action.fieldName);
          break;
        case "addDenormalizationSource":
          if (action.denormSource) {
            this.addDenormalizationSource(target, action.fieldName, action.denormSource);
          }
          break;
        case "addSyncTarget":
          if (action.syncTarget) {
            this.addSyncTarget(target, action.syncTarget);
          }
          break;
      }
    }
  }

  /** Register a class as a Firestore collection */
  registerCollection(
    target: Constructor,
    collectionName: string,
    options?: { idStrategy?: IdStrategy; parentCollection?: string },
  ): void {
    const existing = this.collections.get(target);
    if (existing) {
      existing.collectionName = collectionName;
      if (options?.idStrategy) existing.idStrategy = options.idStrategy;
      if (options?.parentCollection) existing.parentCollection = options.parentCollection;
      return;
    }

    // Merge any pending fields that were registered before @Collection
    const pending = this.pendingFields.get(target);

    this.collections.set(target, {
      collectionName,
      target,
      fields: pending ?? new Map(),
      indexes: [],
      denormalizationSources: new Map(),
      syncTargets: [],
      softDelete: false,
      idStrategy: options?.idStrategy,
      parentCollection: options?.parentCollection,
    });

    if (pending) {
      this.pendingFields.delete(target);
    }
  }

  /** Register a field on a collection class */
  registerField(
    target: Constructor,
    fieldName: string,
    metadata: InternalFieldMetadata,
  ): void {
    const collection = this.collections.get(target);
    if (collection) {
      collection.fields.set(fieldName, metadata);
      return;
    }

    // If @Collection hasn't been applied yet, store as pending
    let pending = this.pendingFields.get(target);
    if (!pending) {
      pending = new Map();
      this.pendingFields.set(target, pending);
    }
    pending.set(fieldName, metadata);
  }

  /** Mark a field as required */
  markRequired(target: Constructor, fieldName: string): void {
    const collection = this.collections.get(target);
    if (collection) {
      const field = collection.fields.get(fieldName);
      if (field) {
        field.required = true;
      }
      return;
    }

    // Check pending fields
    const pending = this.pendingFields.get(target);
    if (pending) {
      const field = pending.get(fieldName);
      if (field) {
        field.required = true;
      }
    }
  }

  /** Add an index to a collection */
  addIndex(target: Constructor, index: IndexSpec): void {
    const collection = this.ensureCollection(target);
    collection.indexes.push(index);
  }

  /** Set rules for a collection */
  setRules(target: Constructor, rules: RulesSpec): void {
    const collection = this.ensureCollection(target);
    collection.rules = { ...collection.rules, ...rules };
  }

  /** Add a denormalization source */
  addDenormalizationSource(
    target: Constructor,
    fieldName: string,
    source: DenormalizationSource,
  ): void {
    const collection = this.ensureCollection(target);
    collection.denormalizationSources.set(fieldName, source);
  }

  /** Add a sync target (deduplicates by targetCollection+field+sourceField) */
  addSyncTarget(target: Constructor, syncTarget: SyncTarget): void {
    const collection = this.ensureCollection(target);
    const exists = collection.syncTargets.some(
      (s) =>
        s.targetCollection === syncTarget.targetCollection &&
        s.field === syncTarget.field &&
        s.sourceField === syncTarget.sourceField,
    );
    if (!exists) {
      collection.syncTargets.push(syncTarget);
    }
  }

  /** Mark a collection as using soft delete */
  markSoftDelete(target: Constructor): void {
    const collection = this.ensureCollection(target);
    collection.softDelete = true;
  }

  /** Get metadata for a specific collection class */
  getCollection(target: Constructor): InternalCollectionMetadata | undefined {
    return this.collections.get(target);
  }

  /** Get all registered collections */
  getAllCollections(): InternalCollectionMetadata[] {
    return Array.from(this.collections.values());
  }

  /** Export collection metadata in the shared format */
  exportMetadata(): CollectionMetadata[] {
    return this.getAllCollections().map((col) => ({
      collectionName: col.collectionName,
      className: col.target.name,
      fields: Array.from(col.fields.values()).map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
        defaultValue: f.defaultValue,
        description: f.description,
        indexed: f.indexed,
        arrayElementType: f.arrayElementType,
        prefill: f.prefill,
        nestedFields: f.nestedType
          ? this.getNestedFields(f.nestedType)
          : undefined,
      })),
      indexes: col.indexes,
      rules: col.rules,
      denormalizationSources: Array.from(col.denormalizationSources.values()),
      syncTargets: col.syncTargets,
      softDelete: col.softDelete,
      idStrategy: col.idStrategy,
      parentCollection: col.parentCollection,
    }));
  }

  /** Clear the registry (for testing) */
  clear(): void {
    this.collections.clear();
    this.pendingFields.clear();
    this.actionQueue = [];
  }

  private ensureCollection(target: Constructor): InternalCollectionMetadata {
    const existing = this.collections.get(target);
    if (existing) {
      return existing;
    }
    // Auto-register with empty collection name (will be set by @Collection)
    this.registerCollection(target, "");
    // registerCollection always sets the entry, so this is safe
    return this.collections.get(target) as InternalCollectionMetadata;
  }

  private getNestedFields(
    nestedType: Constructor,
  ): CollectionMetadata["fields"] | undefined {
    // Check if the nested type has fields registered
    const collection = this.collections.get(nestedType);
    if (collection) {
      return Array.from(collection.fields.values()).map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
        defaultValue: f.defaultValue,
      }));
    }

    const pending = this.pendingFields.get(nestedType);
    if (pending) {
      return Array.from(pending.values()).map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
        defaultValue: f.defaultValue,
      }));
    }

    return undefined;
  }
}

/** Global singleton registry */
const registry = new MetadataRegistry();

/** Get the global metadata registry */
export function getRegistry(): MetadataRegistry {
  return registry;
}
