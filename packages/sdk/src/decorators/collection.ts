import type { IdStrategy } from "@firemap/shared";
import { getRegistry } from "../metadata/registry.js";
import { FiremapError } from "../validation/errors.js";

/** Options for the @Collection decorator */
export interface CollectionOptions {
  /** Document ID generation strategy */
  idStrategy?: IdStrategy;
  /** Parent collection path for subcollections (e.g. 'users/{userId}/posts') */
  parentCollection?: string;
}

/**
 * Marks a class as a Firestore collection model.
 *
 * @param collectionName - The Firestore collection path
 * @param options - Optional configuration for ID strategy and subcollections
 *
 * @example
 * ```ts
 * @Collection('users')
 * class User {
 *   @Field({ type: 'string', required: true })
 *   name!: string;
 * }
 *
 * @Collection('posts', { parentCollection: 'users' })
 * class UserPost {
 *   @Field({ type: 'string', required: true })
 *   title!: string;
 * }
 * ```
 */
export function Collection(collectionName: string, options?: CollectionOptions) {
  if (!collectionName || typeof collectionName !== "string") {
    throw new FiremapError(
      "INVALID_COLLECTION_NAME",
      "Collection name must be a non-empty string. Usage: @Collection('users')",
      { suggestion: "Add a collection name: @Collection('myCollection')" },
    );
  }

  return function <T extends new (...args: unknown[]) => object>(
    target: T,
    _context: ClassDecoratorContext,
  ): T {
    getRegistry().registerCollection(target, collectionName, options);
    // Drain queued field actions — field decorators run before class decorators
    // but don't have the constructor, so they queue their registrations.
    getRegistry().processQueue(target);
    return target;
  };
}
