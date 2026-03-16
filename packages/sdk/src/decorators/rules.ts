import type { RulesSpec } from "@firemap/shared";
import { getRegistry } from "../metadata/registry.js";

/**
 * Declares security rules for a collection.
 *
 * @param rules - Per-operation access expressions in CEL syntax
 *
 * @example
 * ```ts
 * @Rules({ read: 'auth != null', write: 'auth.uid == resource.data.uid' })
 * @Collection('users')
 * class User {
 *   // ...
 * }
 * ```
 */
export function Rules(rules: RulesSpec) {
  return function <T extends new (...args: unknown[]) => object>(
    target: T,
    _context: ClassDecoratorContext,
  ): T {
    getRegistry().setRules(target, rules);
    return target;
  };
}

/**
 * Shortcut: Only the document owner (auth.uid == resource.data.uid) can read/write.
 */
export function AuthOwner<T extends new (...args: unknown[]) => object>(
  target: T,
  _context: ClassDecoratorContext,
): T {
  getRegistry().setRules(target, {
    read: "auth != null && auth.uid == resource.data.uid",
    write: "auth != null && auth.uid == resource.data.uid",
  });
  return target;
}

/**
 * Shortcut: Any authenticated user can read and write.
 */
export function AuthRequired<T extends new (...args: unknown[]) => object>(
  target: T,
  _context: ClassDecoratorContext,
): T {
  getRegistry().setRules(target, {
    read: "auth != null",
    write: "auth != null",
  });
  return target;
}

/**
 * Shortcut: Anyone can read, but only authenticated users can write.
 */
export function PublicRead<T extends new (...args: unknown[]) => object>(
  target: T,
  _context: ClassDecoratorContext,
): T {
  getRegistry().setRules(target, {
    read: "true",
    write: "auth != null",
  });
  return target;
}
