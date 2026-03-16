import { describe, it, expect, beforeEach } from "vitest";
import { getRegistry } from "../../src/metadata/registry.js";
import { Collection } from "../../src/decorators/collection.js";
import {
  Rules,
  AuthOwner,
  AuthRequired,
  PublicRead,
} from "../../src/decorators/rules.js";

describe("@Rules decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("sets read/write rules", () => {
    @Rules({ read: "auth != null", write: "auth.uid == resource.data.uid" })
    @Collection("users")
    class User {}

    const meta = getRegistry().getCollection(User)!;
    expect(meta.rules!.read).toBe("auth != null");
    expect(meta.rules!.write).toBe("auth.uid == resource.data.uid");
  });

  it("sets granular create/update/delete rules", () => {
    @Rules({
      read: "true",
      create: "auth != null",
      update: "auth.uid == resource.data.uid",
      delete: "false",
    })
    @Collection("posts")
    class Post {}

    const meta = getRegistry().getCollection(Post)!;
    expect(meta.rules!.read).toBe("true");
    expect(meta.rules!.create).toBe("auth != null");
    expect(meta.rules!.update).toBe("auth.uid == resource.data.uid");
    expect(meta.rules!.delete).toBe("false");
  });

  it("merges rules from multiple calls", () => {
    class Test {}
    getRegistry().registerCollection(Test, "test");
    getRegistry().setRules(Test, { read: "true" });
    getRegistry().setRules(Test, { write: "auth != null" });

    const meta = getRegistry().getCollection(Test)!;
    expect(meta.rules!.read).toBe("true");
    expect(meta.rules!.write).toBe("auth != null");
  });
});

describe("@AuthOwner decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("sets owner-only read/write rules", () => {
    @AuthOwner
    @Collection("profiles")
    class Profile {}

    const meta = getRegistry().getCollection(Profile)!;
    expect(meta.rules!.read).toContain("auth.uid == resource.data.uid");
    expect(meta.rules!.write).toContain("auth.uid == resource.data.uid");
  });
});

describe("@AuthRequired decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("sets authenticated read/write rules", () => {
    @AuthRequired
    @Collection("data")
    class Data {}

    const meta = getRegistry().getCollection(Data)!;
    expect(meta.rules!.read).toBe("auth != null");
    expect(meta.rules!.write).toBe("auth != null");
  });
});

describe("@PublicRead decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("sets public read + authenticated write rules", () => {
    @PublicRead
    @Collection("articles")
    class Article {}

    const meta = getRegistry().getCollection(Article)!;
    expect(meta.rules!.read).toBe("true");
    expect(meta.rules!.write).toBe("auth != null");
  });
});
