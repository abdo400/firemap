import type { IndexSpec } from "@firemap/shared";
import { getRegistry } from "../metadata/registry.js";

/** Options for @Index */
export interface IndexOptions {
  /** Sort order for the last field (default: ASCENDING) */
  order?: "ASCENDING" | "DESCENDING";
}

/**
 * Declares a composite index requirement for a collection.
 * The CLI uses this to generate `firestore.indexes.json`.
 *
 * @param fields - Array of field paths to include in the index
 * @param options - Optional order specification
 *
 * @example
 * ```ts
 * @Index(['userId', 'createdAt'])
 * @Index(['status', 'updatedAt'], { order: 'DESCENDING' })
 * @Collection('tasks')
 * class Task {
 *   // ...
 * }
 * ```
 */
export function Index(fields: string[], options?: IndexOptions) {
  return function <T extends new (...args: unknown[]) => object>(
    target: T,
    _context: ClassDecoratorContext,
  ): T {
    const index: IndexSpec = {
      fields: fields.map((fieldPath, i) => ({
        fieldPath,
        order:
          i === fields.length - 1 && options?.order
            ? options.order
            : "ASCENDING",
      })),
    };
    getRegistry().addIndex(target, index);
    return target;
  };
}
