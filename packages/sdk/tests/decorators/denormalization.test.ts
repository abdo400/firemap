import { describe, it, expect, beforeEach } from "vitest";
import { getRegistry } from "../../src/metadata/registry.js";
import { Collection } from "../../src/decorators/collection.js";
import { Field } from "../../src/decorators/field.js";
import { DenormalizedFrom, SyncTo } from "../../src/decorators/denormalization.js";

describe("@DenormalizedFrom decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("registers a denormalization source", () => {
    @Collection("posts")
    class Post {
      @DenormalizedFrom("users", { fields: ["name", "avatar"] })
      @Field({ type: "map" })
      author!: Record<string, unknown>;
    }

    new Post();
    const meta = getRegistry().getCollection(Post)!;
    const source = meta.denormalizationSources.get("author");
    expect(source).toBeDefined();
    expect(source!.sourceCollection).toBe("users");
    expect(source!.fields).toEqual(["name", "avatar"]);
  });

  it("registers multiple denormalization sources", () => {
    @Collection("feed")
    class Feed {
      @DenormalizedFrom("users", { fields: ["name"] })
      @Field({ type: "map" })
      author!: Record<string, unknown>;

      @DenormalizedFrom("posts", { fields: ["title"] })
      @Field({ type: "map" })
      post!: Record<string, unknown>;
    }

    new Feed();
    const meta = getRegistry().getCollection(Feed)!;
    expect(meta.denormalizationSources.size).toBe(2);
    expect(meta.denormalizationSources.get("author")!.sourceCollection).toBe("users");
    expect(meta.denormalizationSources.get("post")!.sourceCollection).toBe("posts");
  });
});

describe("@SyncTo decorator", () => {
  beforeEach(() => {
    getRegistry().clear();
  });

  it("registers a sync target", () => {
    @Collection("users")
    class User {
      @SyncTo("posts", { field: "authorName", sourceField: "name" })
      @Field({ type: "string", required: true })
      name!: string;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.syncTargets).toHaveLength(1);
    expect(meta.syncTargets[0]!.targetCollection).toBe("posts");
    expect(meta.syncTargets[0]!.field).toBe("authorName");
    expect(meta.syncTargets[0]!.sourceField).toBe("name");
  });

  it("registers multiple sync targets", () => {
    @Collection("users")
    class User {
      @SyncTo("posts", { field: "authorName", sourceField: "name" })
      @SyncTo("comments", { field: "userName", sourceField: "name" })
      @Field({ type: "string", required: true })
      name!: string;
    }

    new User();
    const meta = getRegistry().getCollection(User)!;
    expect(meta.syncTargets).toHaveLength(2);
  });
});
