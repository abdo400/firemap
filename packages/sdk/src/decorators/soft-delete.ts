import { getRegistry } from "../metadata/registry.js";

/**
 * Marks a collection to use soft delete instead of hard delete.
 * When Model.delete(id) is called, the document gets a `deletedAt` timestamp
 * instead of being removed from Firestore.
 *
 * @example
 * ```ts
 * @SoftDelete
 * @Collection('users')
 * class User {
 *   // ...
 * }
 * ```
 */
export function SoftDelete<T extends new (...args: unknown[]) => object>(
  target: T,
  _context: ClassDecoratorContext,
): T {
  getRegistry().markSoftDelete(target);
  return target;
}
