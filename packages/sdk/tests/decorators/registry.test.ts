import { describe, it, expect, beforeEach } from "vitest";
import { getRegistry } from "../../src/metadata/registry.js";

describe("MetadataRegistry", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("registers a collection", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    const meta = getRegistry().getCollection(TestModel);
    expect(meta).toBeDefined();
    expect(meta!.collectionName).toBe("tests");
  });

  it("returns undefined for unregistered class", () => {
    class Unknown {}
    expect(getRegistry().getCollection(Unknown)).toBeUndefined();
  });

  it("stores fields for a registered collection", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().registerField(TestModel, "name", {
      name: "name",
      type: "string",
      required: true,
    });

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.fields.size).toBe(1);
    expect(meta.fields.get("name")!.type).toBe("string");
    expect(meta.fields.get("name")!.required).toBe(true);
  });

  it("stores pending fields before @Collection is applied", () => {
    class TestModel {}
    // Field registered before collection
    getRegistry().registerField(TestModel, "email", {
      name: "email",
      type: "string",
      required: false,
    });
    // Then collection registered
    getRegistry().registerCollection(TestModel, "tests");

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.fields.size).toBe(1);
    expect(meta.fields.get("email")).toBeDefined();
  });

  it("does not cross-contaminate between classes", () => {
    class ModelA {}
    class ModelB {}
    getRegistry().registerCollection(ModelA, "a");
    getRegistry().registerCollection(ModelB, "b");
    getRegistry().registerField(ModelA, "field_a", {
      name: "field_a",
      type: "string",
      required: false,
    });

    expect(getRegistry().getCollection(ModelA)!.fields.size).toBe(1);
    expect(getRegistry().getCollection(ModelB)!.fields.size).toBe(0);
  });

  it("marks required fields", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().registerField(TestModel, "name", {
      name: "name",
      type: "string",
      required: false,
    });
    getRegistry().markRequired(TestModel, "name");

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.fields.get("name")!.required).toBe(true);
  });

  it("adds indexes", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().addIndex(TestModel, {
      fields: [
        { fieldPath: "userId", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "DESCENDING" },
      ],
    });

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.indexes).toHaveLength(1);
    expect(meta.indexes[0]!.fields[0]!.fieldPath).toBe("userId");
  });

  it("sets rules", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().setRules(TestModel, {
      read: "auth != null",
      write: "auth.uid == resource.data.uid",
    });

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.rules!.read).toBe("auth != null");
    expect(meta.rules!.write).toBe("auth.uid == resource.data.uid");
  });

  it("adds denormalization sources", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().addDenormalizationSource(TestModel, "author", {
      sourceCollection: "users",
      fields: ["name", "avatar"],
    });

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.denormalizationSources.size).toBe(1);
    const source = meta.denormalizationSources.get("author")!;
    expect(source.sourceCollection).toBe("users");
    expect(source.fields).toEqual(["name", "avatar"]);
  });

  it("adds sync targets", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().addSyncTarget(TestModel, {
      targetCollection: "posts",
      field: "authorName",
      sourceField: "name",
    });

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.syncTargets).toHaveLength(1);
    expect(meta.syncTargets[0]!.targetCollection).toBe("posts");
  });

  it("marks soft delete", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().markSoftDelete(TestModel);

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.softDelete).toBe(true);
  });

  it("exports metadata in shared format", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().registerField(TestModel, "name", {
      name: "name",
      type: "string",
      required: true,
    });

    const exported = getRegistry().exportMetadata();
    expect(exported).toHaveLength(1);
    expect(exported[0]!.collectionName).toBe("tests");
    expect(exported[0]!.fields).toHaveLength(1);
    expect(exported[0]!.fields[0]!.name).toBe("name");
  });

  it("returns all collections", () => {
    class A {}
    class B {}
    getRegistry().registerCollection(A, "a");
    getRegistry().registerCollection(B, "b");

    expect(getRegistry().getAllCollections()).toHaveLength(2);
  });

  it("clears all data", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().clear();

    expect(getRegistry().getAllCollections()).toHaveLength(0);
  });

  it("marks required on pending fields before collection registration", () => {
    class TestModel {}
    getRegistry().registerField(TestModel, "name", {
      name: "name",
      type: "string",
      required: false,
    });
    getRegistry().markRequired(TestModel, "name");
    getRegistry().registerCollection(TestModel, "tests");

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.fields.get("name")!.required).toBe(true);
  });

  it("markRequired does nothing for non-existent field on pending", () => {
    class TestModel {}
    getRegistry().registerField(TestModel, "name", {
      name: "name",
      type: "string",
      required: false,
    });
    // Try to mark a non-existent field — should not throw
    getRegistry().markRequired(TestModel, "nonexistent");
    getRegistry().registerCollection(TestModel, "tests");

    const meta = getRegistry().getCollection(TestModel)!;
    expect(meta.fields.get("name")!.required).toBe(false);
  });

  it("markRequired does nothing when no pending or collection exists", () => {
    class TestModel {}
    // No field registered, no collection — should not throw
    expect(() => getRegistry().markRequired(TestModel, "name")).not.toThrow();
  });

  it("markRequired does nothing for non-existent field on registered collection", () => {
    class TestModel {}
    getRegistry().registerCollection(TestModel, "tests");
    getRegistry().markRequired(TestModel, "nonexistent");
    // Should not throw and collection should still be fine
    expect(getRegistry().getCollection(TestModel)!.fields.size).toBe(0);
  });

  it("exports nested fields from registered nested type", () => {
    class Address {}
    getRegistry().registerCollection(Address, "_nested_address");
    getRegistry().registerField(Address, "city", {
      name: "city",
      type: "string",
      required: true,
    });

    class User {}
    getRegistry().registerCollection(User, "users");
    getRegistry().registerField(User, "address", {
      name: "address",
      type: "map",
      required: false,
      nestedType: Address,
    });

    const exported = getRegistry().exportMetadata();
    const userMeta = exported.find((c) => c.collectionName === "users")!;
    const addressField = userMeta.fields.find((f) => f.name === "address")!;
    expect(addressField.nestedFields).toBeDefined();
    expect(addressField.nestedFields).toHaveLength(1);
    expect(addressField.nestedFields![0]!.name).toBe("city");
  });

  it("exports nested fields from pending nested type", () => {
    class Address {}
    // Only add as pending (no registerCollection)
    getRegistry().registerField(Address, "city", {
      name: "city",
      type: "string",
      required: true,
    });

    class User {}
    getRegistry().registerCollection(User, "users");
    getRegistry().registerField(User, "address", {
      name: "address",
      type: "map",
      required: false,
      nestedType: Address,
    });

    const exported = getRegistry().exportMetadata();
    const userMeta = exported.find((c) => c.collectionName === "users")!;
    const addressField = userMeta.fields.find((f) => f.name === "address")!;
    expect(addressField.nestedFields).toHaveLength(1);
  });

  it("returns undefined nestedFields when nested type has no fields", () => {
    class EmptyNested {}

    class User {}
    getRegistry().registerCollection(User, "users");
    getRegistry().registerField(User, "address", {
      name: "address",
      type: "map",
      required: false,
      nestedType: EmptyNested,
    });

    const exported = getRegistry().exportMetadata();
    const userMeta = exported.find((c) => c.collectionName === "users")!;
    const addressField = userMeta.fields.find((f) => f.name === "address")!;
    expect(addressField.nestedFields).toBeUndefined();
  });

  it("ensureCollection auto-registers when adding index to unregistered class", () => {
    class TestModel {}
    getRegistry().addIndex(TestModel, {
      fields: [{ fieldPath: "a", order: "ASCENDING" }],
    });

    const meta = getRegistry().getCollection(TestModel);
    expect(meta).toBeDefined();
    expect(meta!.collectionName).toBe("");
    expect(meta!.indexes).toHaveLength(1);
  });

  it("stores idStrategy and parentCollection", () => {
    class SubCol {}
    getRegistry().registerCollection(SubCol, "comments", {
      idStrategy: "assigned",
      parentCollection: "posts",
    });

    const meta = getRegistry().getCollection(SubCol)!;
    expect(meta.idStrategy).toBe("assigned");
    expect(meta.parentCollection).toBe("posts");
  });

  it("exports idStrategy and parentCollection", () => {
    class SubCol {}
    getRegistry().registerCollection(SubCol, "comments", {
      idStrategy: "auto",
      parentCollection: "posts",
    });

    const exported = getRegistry().exportMetadata();
    expect(exported[0]!.idStrategy).toBe("auto");
    expect(exported[0]!.parentCollection).toBe("posts");
  });
});
