import type { FieldType, PrefillConfig } from "@firemap/shared";
import { getRegistry } from "../metadata/registry.js";
import type { Constructor } from "../metadata/types.js";

/** Options for the @Field decorator */
export interface FieldOptions {
  /** The Firestore field type */
  type: FieldType;
  /** Whether the field is required (default: false) */
  required?: boolean;
  /** Default value for the field */
  default?: unknown;
  /** Description/documentation for the field */
  description?: string;
  /** Whether this field should be indexed */
  indexed?: boolean;
  /** Element type for array fields */
  arrayElementType?: FieldType;
  /** Prefill configuration for backfilling existing documents */
  prefill?: PrefillConfig;
}

/**
 * Defines field metadata for type validation and code generation.
 *
 * @param options - Field type, required flag, and optional default value
 *
 * @example
 * ```ts
 * @Collection('users')
 * class User {
 *   @Field({ type: 'string', required: true })
 *   name!: string;
 *
 *   @Field({ type: 'number', default: 0 })
 *   score!: number;
 * }
 * ```
 */
export function Field(options: FieldOptions) {
  return function <T>(
    _target: undefined,
    context: ClassFieldDecoratorContext<T>,
  ): void {
    const fieldName = String(context.name);
    const metadata = {
      name: fieldName,
      type: options.type,
      required: options.required ?? false,
      defaultValue: options.default,
      description: options.description,
      indexed: options.indexed,
      arrayElementType: options.arrayElementType,
      prefill: options.prefill,
    };

    // Queue for @Collection to process at class definition time (CLI support)
    getRegistry().queueAction({ type: "registerField", fieldName, fieldMetadata: metadata });

    // Also register at instantiation time (runtime fallback)
    context.addInitializer(function (this: T) {
      const constructor = (this as object).constructor as Constructor;
      getRegistry().registerField(constructor, fieldName, metadata);
    });
  };
}

/**
 * Shorthand decorator to mark a field as required.
 * Can be combined with @Field.
 *
 * @example
 * ```ts
 * @Collection('users')
 * class User {
 *   @Required
 *   @Field({ type: 'string' })
 *   email!: string;
 * }
 * ```
 */
export function Required<T>(
  _target: undefined,
  context: ClassFieldDecoratorContext<T>,
): void {
  const fieldName = String(context.name);

  // Queue for @Collection to process at class definition time (CLI support)
  getRegistry().queueAction({ type: "markRequired", fieldName });

  // Also register at instantiation time (runtime fallback)
  context.addInitializer(function (this: T) {
    const constructor = (this as object).constructor as Constructor;
    getRegistry().markRequired(constructor, fieldName);
  });
}
