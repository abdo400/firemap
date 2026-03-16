import { getRegistry } from "../metadata/registry.js";
import type { Constructor } from "../metadata/types.js";

/** Options for @DenormalizedFrom */
export interface DenormalizedFromOptions {
  /** Field names to copy from the source collection */
  fields: string[];
}

/**
 * Marks a field as containing data denormalized from another collection.
 * The CLI uses this metadata to generate Cloud Functions that sync changes.
 *
 * @param sourceCollection - The collection to copy data from
 * @param options - Which fields to denormalize
 *
 * @example
 * ```ts
 * @Collection('posts')
 * class Post {
 *   @DenormalizedFrom('users', { fields: ['name', 'avatar'] })
 *   @Field({ type: 'map' })
 *   author!: { name: string; avatar: string };
 * }
 * ```
 */
export function DenormalizedFrom(
  sourceCollection: string,
  options: DenormalizedFromOptions,
) {
  return function <T>(
    _target: undefined,
    context: ClassFieldDecoratorContext<T>,
  ): void {
    const fieldName = String(context.name);
    const source = { sourceCollection, fields: options.fields };

    // Queue for @Collection to process at class definition time (CLI support)
    getRegistry().queueAction({ type: "addDenormalizationSource", fieldName, denormSource: source });

    // Also register at instantiation time (runtime fallback)
    context.addInitializer(function (this: T) {
      const constructor = (this as object).constructor as Constructor;
      getRegistry().addDenormalizationSource(constructor, fieldName, source);
    });
  };
}

/** Options for @SyncTo */
export interface SyncToOptions {
  /** The field name in the target collection */
  field: string;
  /** The source field name in this collection */
  sourceField: string;
}

/**
 * Marks a field as needing to propagate changes to another collection.
 * The CLI uses this to generate Cloud Functions for outward sync.
 *
 * @param targetCollection - The collection to sync data to
 * @param options - Field mapping
 *
 * @example
 * ```ts
 * @Collection('users')
 * class User {
 *   @SyncTo('posts', { field: 'authorName', sourceField: 'name' })
 *   @Field({ type: 'string', required: true })
 *   name!: string;
 * }
 * ```
 */
export function SyncTo(targetCollection: string, options: SyncToOptions) {
  return function <T>(
    _target: undefined,
    context: ClassFieldDecoratorContext<T>,
  ): void {
    const fieldName = String(context.name);
    const syncTarget = { targetCollection, field: options.field, sourceField: options.sourceField };

    // Queue for @Collection to process at class definition time (CLI support)
    getRegistry().queueAction({ type: "addSyncTarget", fieldName, syncTarget });

    // Also register at instantiation time (runtime fallback)
    context.addInitializer(function (this: T) {
      const constructor = (this as object).constructor as Constructor;
      getRegistry().addSyncTarget(constructor, syncTarget);
    });
  };
}
