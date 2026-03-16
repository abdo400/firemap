import { describe, it, expect, beforeEach } from "vitest";
import { getRegistry } from "../../src/metadata/registry.js";
import { Collection } from "../../src/decorators/collection.js";

describe("@Collection decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("registers a class with collection name", () => {
    @Collection("users")
    class User {}

    const meta = getRegistry().getCollection(User);
    expect(meta).toBeDefined();
    expect(meta!.collectionName).toBe("users");
  });

  it("registers multiple collections independently", () => {
    @Collection("users")
    class User {}

    @Collection("posts")
    class Post {}

    expect(getRegistry().getCollection(User)!.collectionName).toBe("users");
    expect(getRegistry().getCollection(Post)!.collectionName).toBe("posts");
  });

  it("throws on empty collection name", () => {
    expect(() => {
      Collection("");
    }).toThrow("Collection name must be a non-empty string");
  });

  it("throws on non-string collection name", () => {
    expect(() => {
      // @ts-expect-error — testing invalid input
      Collection(123);
    }).toThrow("Collection name must be a non-empty string");
  });

  it("accepts idStrategy option", () => {
    @Collection("users", { idStrategy: "assigned" })
    class User {}

    const meta = getRegistry().getCollection(User);
    expect(meta!.idStrategy).toBe("assigned");
  });

  it("defaults idStrategy to undefined", () => {
    @Collection("users")
    class User {}

    const meta = getRegistry().getCollection(User);
    expect(meta!.idStrategy).toBeUndefined();
  });

  it("accepts parentCollection option for subcollections", () => {
    @Collection("posts", { parentCollection: "users" })
    class UserPost {}

    const meta = getRegistry().getCollection(UserPost);
    expect(meta!.parentCollection).toBe("users");
  });

  it("accepts both idStrategy and parentCollection", () => {
    @Collection("comments", { idStrategy: "auto", parentCollection: "posts" })
    class Comment {}

    const meta = getRegistry().getCollection(Comment);
    expect(meta!.idStrategy).toBe("auto");
    expect(meta!.parentCollection).toBe("posts");
  });

  it("re-registration updates collection name", () => {
    class User {}
    getRegistry().registerCollection(User, "old_name");
    getRegistry().registerCollection(User, "users");

    const meta = getRegistry().getCollection(User);
    expect(meta!.collectionName).toBe("users");
  });

  it("re-registration updates options", () => {
    class User {}
    getRegistry().registerCollection(User, "users");
    getRegistry().registerCollection(User, "users", {
      idStrategy: "assigned",
      parentCollection: "orgs",
    });

    const meta = getRegistry().getCollection(User);
    expect(meta!.idStrategy).toBe("assigned");
    expect(meta!.parentCollection).toBe("orgs");
  });
});
