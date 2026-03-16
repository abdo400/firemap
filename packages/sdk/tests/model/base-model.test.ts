import { describe, it, expect, beforeEach, vi } from "vitest";
import { getRegistry } from "../../src/metadata/registry.js";
import { BaseModel, initializeFiremap } from "../../src/model/base-model.js";
import { FiremapError } from "../../src/validation/errors.js";

// ─── Mock Firestore ────────────────────────────────────────────────

function createMockDoc(id: string, data: Record<string, unknown> | undefined) {
  return {
    id,
    exists: data !== undefined,
    data: () => data,
    ref: { id },
  };
}

function createMockFirestore(
  docs: Array<{ id: string; data: Record<string, unknown> }> = [],
) {
  const store = new Map(docs.map((d) => [d.id, d.data]));
  const docRefs = new Map<string, ReturnType<typeof makeDocRef>>();

  function makeDocRef(id: string) {
    return {
      id,
      get: vi.fn(async () => {
        const data = store.get(id);
        return createMockDoc(id, data);
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        store.set(id, data);
      }),
      update: vi.fn(async (data: Record<string, unknown>) => {
        const existing = store.get(id) ?? {};
        store.set(id, { ...existing, ...data });
      }),
      delete: vi.fn(async () => {
        store.delete(id);
      }),
    };
  }

  function getDocRef(id: string) {
    let ref = docRefs.get(id);
    if (!ref) {
      ref = makeDocRef(id);
      docRefs.set(id, ref);
    }
    return ref;
  }

  let addCounter = 0;

  const collectionRef = {
    doc: vi.fn((id: string) => getDocRef(id)),
    add: vi.fn(async (data: Record<string, unknown>) => {
      const id = `auto_${++addCounter}`;
      store.set(id, data);
      return { id };
    }),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    get: vi.fn(async () => ({
      docs: Array.from(store.entries()).map(([id, data]) =>
        createMockDoc(id, data),
      ),
    })),
    onSnapshot: vi.fn(),
  } as any;

  // Chainable query methods
  collectionRef.where.mockReturnValue(collectionRef);
  collectionRef.orderBy.mockReturnValue(collectionRef);
  collectionRef.limit.mockReturnValue(collectionRef);

  const db = {
    collection: vi.fn(() => collectionRef),
  };

  return { db, collectionRef, store };
}

// ─── Test Model ────────────────────────────────────────────────────

function setupTestModel() {
  class TestUser extends BaseModel {
    name!: string;
    email!: string;
    age!: number;
  }

  getRegistry().registerCollection(TestUser, "users");
  getRegistry().registerField(TestUser, "name", {
    name: "name",
    type: "string",
    required: true,
  });
  getRegistry().registerField(TestUser, "email", {
    name: "email",
    type: "string",
    required: true,
  });
  getRegistry().registerField(TestUser, "age", {
    name: "age",
    type: "number",
    required: false,
  });

  return TestUser;
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("initializeFiremap", () => {
  it("allows Firestore to be initialized", () => {
    const { db } = createMockFirestore();
    expect(() => initializeFiremap(db)).not.toThrow();
  });
});

describe("BaseModel", () => {
  let TestUser: ReturnType<typeof setupTestModel>;

  beforeEach(() => {
    getRegistry().clear();
    TestUser = setupTestModel();
  });

  describe("findById", () => {
    it("returns a typed model instance", async () => {
      const { db } = createMockFirestore([
        { id: "u1", data: { name: "John", email: "john@test.com", age: 25 } },
      ]);
      initializeFiremap(db);

      const user = await TestUser.findById("u1");
      expect(user).not.toBeNull();
      expect(user!.id).toBe("u1");
      expect(user!.name).toBe("John");
      expect(user!.email).toBe("john@test.com");
      expect(user!).toBeInstanceOf(TestUser);
    });

    it("returns null for non-existent document", async () => {
      const { db } = createMockFirestore();
      initializeFiremap(db);

      const user = await TestUser.findById("nonexistent");
      expect(user).toBeNull();
    });

    it("handles documents with no data", async () => {
      const { db, collectionRef } = createMockFirestore();
      // Override doc.get to return exists but no data
      collectionRef.doc.mockReturnValueOnce({
        get: vi.fn(async () => ({ id: "u1", exists: true, data: () => undefined })),
      } as any);
      initializeFiremap(db);

      const user = await TestUser.findById("u1");
      expect(user).not.toBeNull();
      expect(user!.id).toBe("u1");
    });
  });

  describe("find", () => {
    it("returns all documents without options", async () => {
      const { db } = createMockFirestore([
        { id: "u1", data: { name: "John", email: "john@test.com" } },
        { id: "u2", data: { name: "Jane", email: "jane@test.com" } },
      ]);
      initializeFiremap(db);

      const users = await TestUser.find();
      expect(users).toHaveLength(2);
      expect(users[0]).toBeInstanceOf(TestUser);
    });

    it("applies where clause as object", async () => {
      const { db, collectionRef } = createMockFirestore([
        { id: "u1", data: { name: "John", email: "john@test.com" } },
      ]);
      initializeFiremap(db);

      await TestUser.find({ where: { name: "John" } });
      expect(collectionRef.where).toHaveBeenCalledWith("name", "==", "John");
    });

    it("applies where clause as array", async () => {
      const { db, collectionRef } = createMockFirestore([
        { id: "u1", data: { name: "John", email: "john@test.com" } },
      ]);
      initializeFiremap(db);

      await TestUser.find({
        where: [{ field: "age", op: ">", value: 18 }],
      });
      expect(collectionRef.where).toHaveBeenCalledWith("age", ">", 18);
    });

    it("applies string orderBy", async () => {
      const { db, collectionRef } = createMockFirestore();
      initializeFiremap(db);

      await TestUser.find({ orderBy: "name" });
      expect(collectionRef.orderBy).toHaveBeenCalledWith("name");
    });

    it("applies object orderBy", async () => {
      const { db, collectionRef } = createMockFirestore();
      initializeFiremap(db);

      await TestUser.find({ orderBy: { field: "name", direction: "desc" } });
      expect(collectionRef.orderBy).toHaveBeenCalledWith("name", "desc");
    });

    it("applies limit", async () => {
      const { db, collectionRef } = createMockFirestore();
      initializeFiremap(db);

      await TestUser.find({ limit: 10 });
      expect(collectionRef.limit).toHaveBeenCalledWith(10);
    });

    it("handles docs with no data in results", async () => {
      const { db, collectionRef } = createMockFirestore();
      collectionRef.get.mockResolvedValueOnce({
        docs: [{ id: "u1", exists: true, data: () => undefined }],
      });
      initializeFiremap(db);

      const users = await TestUser.find();
      expect(users).toHaveLength(1);
      expect(users[0]!.id).toBe("u1");
    });
  });

  describe("create", () => {
    it("creates a document with auto-generated ID", async () => {
      const { db } = createMockFirestore();
      initializeFiremap(db);

      const user = await TestUser.create({
        name: "John",
        email: "john@test.com",
      } as any);

      expect(user.id).toBe("auto_1");
      expect(user.name).toBe("John");
      expect(user).toBeInstanceOf(TestUser);
    });

    it("creates a document with specified ID", async () => {
      const { db } = createMockFirestore();
      initializeFiremap(db);

      const user = await TestUser.create(
        { name: "John", email: "john@test.com" } as any,
        "custom-id",
      );

      expect(user.id).toBe("custom-id");
    });

    it("applies default values", async () => {
      getRegistry().clear();
      class ModelWithDefault extends BaseModel {
        score!: number;
        name!: string;
      }
      getRegistry().registerCollection(ModelWithDefault, "models");
      getRegistry().registerField(ModelWithDefault, "score", {
        name: "score",
        type: "number",
        required: false,
        defaultValue: 100,
      });
      getRegistry().registerField(ModelWithDefault, "name", {
        name: "name",
        type: "string",
        required: true,
      });

      const { db } = createMockFirestore();
      initializeFiremap(db);

      const model = await ModelWithDefault.create({ name: "Test" } as any);
      expect(model.score).toBe(100);
    });

    it("validates required fields", async () => {
      const { db } = createMockFirestore();
      initializeFiremap(db);

      await expect(
        TestUser.create({ name: "John" } as any),
      ).rejects.toThrow("required");
    });

    it("validates field types", async () => {
      const { db } = createMockFirestore();
      initializeFiremap(db);

      await expect(
        TestUser.create({
          name: 123,
          email: "test@test.com",
        } as any),
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates a document", async () => {
      const { db, collectionRef } = createMockFirestore([
        { id: "u1", data: { name: "John", email: "john@test.com" } },
      ]);
      initializeFiremap(db);

      await TestUser.update("u1", { name: "Jane" });
      const doc = collectionRef.doc("u1");
      expect(doc.update).toHaveBeenCalled();
    });

    it("validates types on update", async () => {
      const { db } = createMockFirestore();
      initializeFiremap(db);

      await expect(
        TestUser.update("u1", { name: 123 } as any),
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("hard deletes a document", async () => {
      const { db, collectionRef } = createMockFirestore([
        { id: "u1", data: { name: "John", email: "john@test.com" } },
      ]);
      initializeFiremap(db);

      await TestUser.delete("u1");
      const doc = collectionRef.doc("u1");
      expect(doc.delete).toHaveBeenCalled();
    });

    it("soft deletes when @SoftDelete is applied", async () => {
      getRegistry().clear();
      class SoftUser extends BaseModel {
        name!: string;
      }
      getRegistry().registerCollection(SoftUser, "users");
      getRegistry().registerField(SoftUser, "name", {
        name: "name",
        type: "string",
        required: false,
      });
      getRegistry().markSoftDelete(SoftUser);

      const { db, collectionRef } = createMockFirestore([
        { id: "u1", data: { name: "John" } },
      ]);
      initializeFiremap(db);

      await SoftUser.delete("u1");
      const doc = collectionRef.doc("u1");
      expect(doc.update).toHaveBeenCalled();
      const updateCall = doc.update.mock.calls[0]![0] as Record<string, unknown>;
      expect(updateCall["deletedAt"]).toBeInstanceOf(Date);
    });
  });

  describe("stream", () => {
    it("subscribes to real-time updates with callback only", () => {
      const { db, collectionRef } = createMockFirestore();
      const unsubscribe = vi.fn();
      collectionRef.onSnapshot.mockReturnValue(unsubscribe);
      initializeFiremap(db);

      const cb = vi.fn();
      const unsub = TestUser.stream(cb);

      expect(collectionRef.onSnapshot).toHaveBeenCalled();
      expect(unsub).toBe(unsubscribe);
    });

    it("subscribes with options and callback", () => {
      const { db, collectionRef } = createMockFirestore();
      collectionRef.onSnapshot.mockReturnValue(vi.fn());
      initializeFiremap(db);

      const cb = vi.fn();
      TestUser.stream({ where: { name: "John" } }, cb);

      expect(collectionRef.where).toHaveBeenCalledWith("name", "==", "John");
      expect(collectionRef.onSnapshot).toHaveBeenCalled();
    });

    it("throws when options provided without callback", () => {
      const { db } = createMockFirestore();
      initializeFiremap(db);

      expect(() =>
        TestUser.stream({ where: { name: "John" } }),
      ).toThrow("stream() requires a callback");
    });

    it("applies orderBy and limit to stream", () => {
      const { db, collectionRef } = createMockFirestore();
      collectionRef.onSnapshot.mockReturnValue(vi.fn());
      initializeFiremap(db);

      TestUser.stream(
        { orderBy: { field: "name", direction: "asc" }, limit: 5 },
        vi.fn(),
      );

      expect(collectionRef.orderBy).toHaveBeenCalledWith("name", "asc");
      expect(collectionRef.limit).toHaveBeenCalledWith(5);
    });

    it("applies where array to stream", () => {
      const { db, collectionRef } = createMockFirestore();
      collectionRef.onSnapshot.mockReturnValue(vi.fn());
      initializeFiremap(db);

      TestUser.stream(
        { where: [{ field: "age", op: ">", value: 18 }] },
        vi.fn(),
      );

      expect(collectionRef.where).toHaveBeenCalledWith("age", ">", 18);
    });

    it("maps snapshot docs to model instances", () => {
      const { db, collectionRef } = createMockFirestore();
      let capturedCb: (snapshot: any) => void;
      collectionRef.onSnapshot.mockImplementation((cb: any) => {
        capturedCb = cb;
        return vi.fn();
      });
      initializeFiremap(db);

      const cb = vi.fn();
      TestUser.stream(cb);

      // Simulate a snapshot
      capturedCb!({
        docs: [
          createMockDoc("u1", { name: "John", email: "john@test.com" }),
          createMockDoc("u2", { name: "Jane", email: "jane@test.com" }),
        ],
      });

      expect(cb).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "u1", name: "John" }),
          expect.objectContaining({ id: "u2", name: "Jane" }),
        ]),
      );
    });

    it("handles docs with no data in stream snapshot", () => {
      const { db, collectionRef } = createMockFirestore();
      let capturedCb: (snapshot: any) => void;
      collectionRef.onSnapshot.mockImplementation((cb: any) => {
        capturedCb = cb;
        return vi.fn();
      });
      initializeFiremap(db);

      const cb = vi.fn();
      TestUser.stream(cb);

      capturedCb!({
        docs: [{ id: "u1", exists: true, data: () => undefined }],
      });

      expect(cb).toHaveBeenCalledWith([expect.objectContaining({ id: "u1" })]);
    });
  });

  describe("select", () => {
    it("returns a SelectQuery that filters fields", async () => {
      const { db, collectionRef } = createMockFirestore([
        { id: "u1", data: { name: "John", email: "john@test.com", age: 25 } },
      ]);
      initializeFiremap(db);

      const result = await TestUser.select(["name"]).find();
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("u1");
      expect(result[0]!.name).toBe("John");
      expect((result[0] as any).email).toBeUndefined();
    });

    it("applies where clause in select query", async () => {
      const { db, collectionRef } = createMockFirestore([
        { id: "u1", data: { name: "John", email: "john@test.com" } },
      ]);
      initializeFiremap(db);

      await TestUser.select(["name"]).find({
        where: { name: "John" },
      });
      expect(collectionRef.where).toHaveBeenCalledWith("name", "==", "John");
    });

    it("applies where array in select query", async () => {
      const { db, collectionRef } = createMockFirestore();
      initializeFiremap(db);

      await TestUser.select(["name"]).find({
        where: [{ field: "age", op: ">=", value: 18 }],
      });
      expect(collectionRef.where).toHaveBeenCalledWith("age", ">=", 18);
    });

    it("applies orderBy string in select query", async () => {
      const { db, collectionRef } = createMockFirestore();
      initializeFiremap(db);

      await TestUser.select(["name"]).find({ orderBy: "name" });
      expect(collectionRef.orderBy).toHaveBeenCalledWith("name");
    });

    it("applies orderBy object in select query", async () => {
      const { db, collectionRef } = createMockFirestore();
      initializeFiremap(db);

      await TestUser.select(["name"]).find({
        orderBy: { field: "name", direction: "desc" },
      });
      expect(collectionRef.orderBy).toHaveBeenCalledWith("name", "desc");
    });

    it("applies limit in select query", async () => {
      const { db, collectionRef } = createMockFirestore();
      initializeFiremap(db);

      await TestUser.select(["name"]).find({ limit: 5 });
      expect(collectionRef.limit).toHaveBeenCalledWith(5);
    });

    it("calls .select() on Admin SDK", async () => {
      const { db, collectionRef } = createMockFirestore([
        { id: "u1", data: { name: "John", email: "john@test.com" } },
      ]);
      collectionRef.select = vi.fn().mockReturnValue(collectionRef);
      initializeFiremap(db, true);

      await TestUser.select(["name"]).find();
      expect(collectionRef.select).toHaveBeenCalledWith("name");
    });

    it("handles docs with no data in select results", async () => {
      const { db, collectionRef } = createMockFirestore();
      collectionRef.get.mockResolvedValueOnce({
        docs: [{ id: "u1", exists: true, data: () => undefined }],
      });
      initializeFiremap(db);

      const result = await TestUser.select(["name"]).find();
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("u1");
    });
  });

  describe("withConverter", () => {
    it("returns a data converter", () => {
      const converter = TestUser.withConverter();
      expect(converter).toBeDefined();
      expect(converter.toFirestore).toBeInstanceOf(Function);
      expect(converter.fromFirestore).toBeInstanceOf(Function);
    });

    it("toFirestore extracts registered fields", () => {
      const converter = TestUser.withConverter();
      const user = Object.create(TestUser.prototype);
      user.name = "John";
      user.email = "john@test.com";
      user.extraField = "ignored";

      const result = converter.toFirestore(user);
      expect(result.name).toBe("John");
      expect(result.email).toBe("john@test.com");
      expect(result.extraField).toBeUndefined();
    });

    it("toFirestore skips undefined values", () => {
      const converter = TestUser.withConverter();
      const user = Object.create(TestUser.prototype);
      user.name = "John";
      // email is undefined

      const result = converter.toFirestore(user);
      expect(result.name).toBe("John");
      expect("email" in result).toBe(false);
    });

    it("fromFirestore creates a typed instance", () => {
      const converter = TestUser.withConverter();
      const snapshot = createMockDoc("u1", {
        name: "John",
        email: "john@test.com",
      });

      const result = converter.fromFirestore(snapshot);
      expect(result.id).toBe("u1");
      expect(result.name).toBe("John");
      expect(result).toBeInstanceOf(TestUser);
    });

    it("fromFirestore handles snapshot with no data", () => {
      const converter = TestUser.withConverter();
      const snapshot = createMockDoc("u1", undefined);
      // Override data to return null
      (snapshot as any).data = () => null;

      const result = converter.fromFirestore(snapshot as any);
      expect(result.id).toBe("u1");
    });
  });

  describe("error handling", () => {
    it("throws if Firestore not initialized", async () => {
      // Reset the firestore instance by passing null
      initializeFiremap(null as any);
      // The getFirestore() check should throw
      await expect(TestUser.findById("u1")).rejects.toThrow(
        "not initialized",
      );
    });

    it("throws if class is not registered", async () => {
      const { db } = createMockFirestore();
      initializeFiremap(db);

      class Unregistered extends BaseModel {}

      await expect(Unregistered.findById("x")).rejects.toThrow(
        "not registered",
      );
    });
  });
});

describe("exportMetadata with new fields", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("exports description and indexed", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "test");
    getRegistry().registerField(TestModel, "name", {
      name: "name",
      type: "string",
      required: true,
      description: "The name",
      indexed: true,
    });

    const exported = getRegistry().exportMetadata();
    expect(exported[0]!.fields[0]!.description).toBe("The name");
    expect(exported[0]!.fields[0]!.indexed).toBe(true);
  });

  it("exports arrayElementType", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "test");
    getRegistry().registerField(TestModel, "tags", {
      name: "tags",
      type: "array",
      required: false,
      arrayElementType: "string",
    });

    const exported = getRegistry().exportMetadata();
    expect(exported[0]!.fields[0]!.arrayElementType).toBe("string");
  });

  it("exports prefill config", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "test");
    getRegistry().registerField(TestModel, "bio", {
      name: "bio",
      type: "string",
      required: false,
      prefill: { enabled: true, mode: "null" },
    });

    const exported = getRegistry().exportMetadata();
    expect(exported[0]!.fields[0]!.prefill).toEqual({
      enabled: true,
      mode: "null",
    });
  });

  it("exports idStrategy and parentCollection", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "posts", {
      idStrategy: "assigned",
      parentCollection: "users",
    });

    const exported = getRegistry().exportMetadata();
    expect(exported[0]!.idStrategy).toBe("assigned");
    expect(exported[0]!.parentCollection).toBe("users");
  });
});
