import { getRegistry } from "../metadata/registry.js";
import { FiremapError } from "../validation/errors.js";
import { validateCreate, validateUpdate } from "../validation/runtime-guard.js";
import type { Constructor, InternalCollectionMetadata } from "../metadata/types.js";

/** Query options for find() */
export interface FindOptions<T> {
  where?: Partial<Record<string & keyof T, unknown>> | WhereClause[];
  orderBy?: (string & keyof T) | OrderByClause;
  limit?: number;
  startAfter?: unknown;
}

export interface WhereClause {
  field: string;
  op: "<" | "<=" | "==" | "!=" | ">=" | ">" | "array-contains" | "in";
  value: unknown;
}

export interface OrderByClause {
  field: string;
  direction: "asc" | "desc";
}

/** Stream callback */
export type StreamCallback<T> = (data: T[]) => void;

/** Unsubscribe function returned by stream() */
export type Unsubscribe = () => void;

// Type for Firestore instance (from either client or admin SDK)
interface FirestoreInstance {
  collection: (path: string) => unknown;
  doc?: (path: string) => unknown;
}

/** Global Firestore instance reference */
let firestoreInstance: FirestoreInstance | null = null;
let isAdminSDK = false;

/**
 * Initialize Firemap with a Firestore instance.
 * Call this once at application startup.
 *
 * @param firestore - Firestore instance from firebase/firestore or firebase-admin
 * @param admin - Whether this is the Admin SDK (enables server-side features)
 */
export function initializeFiremap(
  firestore: FirestoreInstance,
  admin = false,
): void {
  firestoreInstance = firestore;
  isAdminSDK = admin;
}

function getFirestore(): FirestoreInstance {
  if (!firestoreInstance) {
    throw new FiremapError(
      "NOT_INITIALIZED",
      "Firemap is not initialized. Call initializeFiremap(firestore) first.",
      { suggestion: "Add initializeFiremap(db) at app startup" },
    );
  }
  return firestoreInstance;
}

function getMetadata(target: Constructor): InternalCollectionMetadata {
  const meta = getRegistry().getCollection(target);
  if (!meta) {
    throw new FiremapError(
      "NOT_REGISTERED",
      `Class '${target.name}' is not registered. Did you add @Collection()?`,
      {
        collection: target.name,
        suggestion: `Add @Collection('collectionName') to ${target.name}`,
      },
    );
  }
  return meta;
}

/**
 * Base model class providing typed Firestore operations.
 * All model classes should extend BaseModel and apply @Collection.
 *
 * @example
 * ```ts
 * @Collection('users')
 * class User extends BaseModel {
 *   @Field({ type: 'string', required: true })
 *   name!: string;
 *
 *   @Field({ type: 'string', required: true })
 *   email!: string;
 * }
 *
 * // Usage:
 * const user = await User.findById('abc123');
 * await User.create({ name: 'John', email: 'john@test.com' });
 * ```
 */
export class BaseModel {
  /** Document ID */
  id!: string;

  /** Get a typed Firestore data converter */
  static withConverter<T extends BaseModel>(
    this: new () => T,
  ): FirestoreDataConverter<T> {
    const meta = getMetadata(this);
    return {
      toFirestore(data: T): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [fieldName] of meta.fields) {
          const value = (data as Record<string, unknown>)[fieldName];
          if (value !== undefined) {
            result[fieldName] = value;
          }
        }
        return result;
      },
      fromFirestore(
        snapshot: DocumentSnapshotLike,
      ): T {
        const data = snapshot.data();
        const instance = Object.create(
          (meta.target as new () => T).prototype,
        ) as T;
        instance.id = snapshot.id;
        if (data) {
          Object.assign(instance, data);
        }
        return instance;
      },
    };
  }

  /** Find a document by ID */
  static async findById<T extends BaseModel>(
    this: new () => T,
    id: string,
  ): Promise<T | null> {
    const db = getFirestore();
    const meta = getMetadata(this);
    const collectionRef = db.collection(meta.collectionName) as CollectionRefLike;
    const docRef = collectionRef.doc(id);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return null;
    }

    const instance = Object.create(this.prototype) as T;
    instance.id = snapshot.id;
    const data = snapshot.data();
    if (data) {
      Object.assign(instance, data);
    }
    return instance;
  }

  /** Query documents with typed filters */
  static async find<T extends BaseModel>(
    this: new () => T,
    options?: FindOptions<T>,
  ): Promise<T[]> {
    const db = getFirestore();
    const meta = getMetadata(this);
    let query: QueryLike = db.collection(
      meta.collectionName,
    ) as unknown as QueryLike;

    if (options?.where) {
      if (Array.isArray(options.where)) {
        for (const clause of options.where) {
          query = query.where(clause.field, clause.op, clause.value);
        }
      } else {
        for (const [field, value] of Object.entries(options.where)) {
          query = query.where(field, "==", value);
        }
      }
    }

    if (options?.orderBy) {
      if (typeof options.orderBy === "string") {
        query = query.orderBy(options.orderBy as string);
      } else {
        query = query.orderBy(
          options.orderBy.field,
          options.orderBy.direction,
        );
      }
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc: DocumentSnapshotLike) => {
      const instance = Object.create(this.prototype) as T;
      instance.id = doc.id;
      const data = doc.data();
      if (data) {
        Object.assign(instance, data);
      }
      return instance;
    });
  }

  /** Create a field projection query builder */
  static select<T extends BaseModel>(
    this: new () => T,
    fields: Array<keyof T & string>,
  ): SelectQuery<T> {
    return new SelectQuery<T>(this, fields);
  }

  /** Create a new document with validation */
  static async create<T extends BaseModel>(
    this: new () => T,
    data: Omit<T, "id">,
    id?: string,
  ): Promise<T> {
    const db = getFirestore();
    const meta = getMetadata(this);

    // Populate defaults for missing fields
    const dataWithDefaults = { ...data } as Record<string, unknown>;
    for (const [fieldName, fieldMeta] of meta.fields) {
      if (
        !(fieldName in dataWithDefaults) &&
        fieldMeta.defaultValue !== undefined
      ) {
        dataWithDefaults[fieldName] = fieldMeta.defaultValue;
      }
    }

    // Validate
    validateCreate(dataWithDefaults, meta.fields, meta.collectionName);

    const collectionRef = db.collection(meta.collectionName) as CollectionRefLike;

    let docId: string;
    if (id) {
      await collectionRef.doc(id).set(dataWithDefaults);
      docId = id;
    } else {
      const docRef = await collectionRef.add(dataWithDefaults);
      docId = docRef.id;
    }

    const instance = Object.create(this.prototype) as T;
    instance.id = docId;
    Object.assign(instance, dataWithDefaults);
    return instance;
  }

  /** Update a document with partial validation */
  static async update<T extends BaseModel>(
    this: new () => T,
    id: string,
    data: Partial<Omit<T, "id">>,
  ): Promise<void> {
    const db = getFirestore();
    const meta = getMetadata(this);

    validateUpdate(
      data as Record<string, unknown>,
      meta.fields,
      meta.collectionName,
    );

    const collectionRef = db.collection(meta.collectionName) as CollectionRefLike;
    await collectionRef.doc(id).update(data as Record<string, unknown>);
  }

  /** Delete a document (hard delete, or soft delete if @SoftDelete is applied) */
  static async delete<T extends BaseModel>(
    this: new () => T,
    id: string,
  ): Promise<void> {
    const db = getFirestore();
    const meta = getMetadata(this);
    const collectionRef = db.collection(meta.collectionName) as CollectionRefLike;

    if (meta.softDelete) {
      await collectionRef.doc(id).update({
        deletedAt: new Date(),
      });
    } else {
      await collectionRef.doc(id).delete();
    }
  }

  /** Subscribe to real-time updates */
  static stream<T extends BaseModel>(
    this: new () => T,
    optionsOrCallback: FindOptions<T> | StreamCallback<T>,
    callback?: StreamCallback<T>,
  ): Unsubscribe {
    const db = getFirestore();
    const meta = getMetadata(this);

    let options: FindOptions<T> | undefined;
    let cb: StreamCallback<T>;

    if (typeof optionsOrCallback === "function") {
      cb = optionsOrCallback;
    } else {
      options = optionsOrCallback;
      if (!callback) {
        throw new FiremapError(
          "INVALID_ARGUMENT",
          "stream() requires a callback when options are provided.",
          { suggestion: "Pass a callback as the second argument" },
        );
      }
      cb = callback;
    }

    let query: QueryLike = db.collection(
      meta.collectionName,
    ) as unknown as QueryLike;

    if (options?.where) {
      if (Array.isArray(options.where)) {
        for (const clause of options.where) {
          query = query.where(clause.field, clause.op, clause.value);
        }
      } else {
        for (const [field, value] of Object.entries(options.where)) {
          query = query.where(field, "==", value);
        }
      }
    }

    if (options?.orderBy) {
      if (typeof options.orderBy === "string") {
        query = query.orderBy(options.orderBy as string);
      } else {
        query = query.orderBy(
          options.orderBy.field,
          options.orderBy.direction,
        );
      }
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const prototype = this.prototype;
    return query.onSnapshot((snapshot: QuerySnapshotLike) => {
      const results = snapshot.docs.map((doc: DocumentSnapshotLike) => {
        const instance = Object.create(prototype) as T;
        instance.id = doc.id;
        const data = doc.data();
        if (data) {
          Object.assign(instance, data);
        }
        return instance;
      });
      cb(results);
    });
  }
}

/** Field projection query builder */
class SelectQuery<T extends BaseModel> {
  constructor(
    private modelClass: new () => T,
    private fields: string[],
  ) {}

  async find(options?: FindOptions<T>): Promise<Partial<T>[]> {
    const db = getFirestore();
    const meta = getMetadata(this.modelClass);
    let query: QueryLike = db.collection(
      meta.collectionName,
    ) as unknown as QueryLike;

    // Apply select if Admin SDK (client SDK doesn't support .select())
    if (isAdminSDK && query.select) {
      query = query.select(...this.fields);
    }

    if (options?.where) {
      if (Array.isArray(options.where)) {
        for (const clause of options.where) {
          query = query.where(clause.field, clause.op, clause.value);
        }
      } else {
        for (const [field, value] of Object.entries(options.where)) {
          query = query.where(field, "==", value);
        }
      }
    }

    if (options?.orderBy) {
      if (typeof options.orderBy === "string") {
        query = query.orderBy(options.orderBy as string);
      } else {
        query = query.orderBy(
          options.orderBy.field,
          options.orderBy.direction,
        );
      }
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    const selectedFields = new Set(this.fields);

    return snapshot.docs.map((doc: DocumentSnapshotLike) => {
      const instance: Partial<T> = { id: doc.id } as Partial<T>;
      const data = doc.data();
      if (data) {
        for (const [key, value] of Object.entries(data)) {
          if (selectedFields.has(key)) {
            (instance as Record<string, unknown>)[key] = value;
          }
        }
      }
      return instance;
    });
  }
}

// Minimal type interfaces for Firestore compatibility
// These allow the SDK to work with both client and admin Firestore
interface FirestoreDataConverter<T> {
  toFirestore(data: T): Record<string, unknown>;
  fromFirestore(snapshot: DocumentSnapshotLike): T;
}

interface DocumentSnapshotLike {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

interface QuerySnapshotLike {
  docs: DocumentSnapshotLike[];
}

interface DocumentRefLike {
  id: string;
  get(): Promise<DocumentSnapshotLike>;
  set(data: Record<string, unknown>): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}

interface CollectionRefLike {
  doc(id: string): DocumentRefLike;
  add(data: Record<string, unknown>): Promise<DocumentRefLike>;
}

interface QueryLike {
  where(field: string, op: string, value: unknown): QueryLike;
  orderBy(field: string, direction?: string): QueryLike;
  limit(n: number): QueryLike;
  select?(...fields: string[]): QueryLike;
  get(): Promise<QuerySnapshotLike>;
  onSnapshot(callback: (snapshot: QuerySnapshotLike) => void): Unsubscribe;
}
