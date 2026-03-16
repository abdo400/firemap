# Firemap

Type-safe Firestore ODM with TypeScript decorators. Define your schema once — Firemap validates at runtime and generates Cloud Functions, indexes, and security rules.

## Installation

```bash
npm install @firemap/sdk
```

## Quick Start

```typescript
import { Collection, Field, Required, BaseModel, initializeFiremap } from '@firemap/sdk';
import { getFirestore } from 'firebase/firestore';

// Initialize
initializeFiremap(getFirestore());

// Define your schema
@Collection('users')
class User extends BaseModel {
  @Required
  @Field({ type: 'string' })
  name!: string;

  @Required
  @Field({ type: 'string' })
  email!: string;

  @Field({ type: 'number' })
  age!: number;
}

// Typed CRUD
const user = await User.create({ name: 'John', email: 'john@example.com', age: 30 });
const found = await User.findById(user.id);
await User.update(user.id, { age: 31 });
await User.delete(user.id);
```

## Decorators

### Collections

```typescript
@Collection('posts')
class Post extends BaseModel { ... }

@Collection('comments', { parentCollection: 'posts' })
class Comment extends BaseModel { ... }
```

### Fields

```typescript
@Field({ type: 'string' })           // string, number, boolean, timestamp,
@Field({ type: 'array' })            // geopoint, reference, array, map, bytes
@Field({ type: 'map' })
@Field({ type: 'string', default: 'draft' })
```

### Validation

```typescript
@Required                              // Mark field as required
@Field({ type: 'string', required: true })  // Or inline
```

### Security Rules

```typescript
@Rules({ read: 'auth != null', write: 'auth.uid == resource.data.uid' })
@AuthRequired        // Shortcut: auth != null for read & write
@AuthOwner           // Shortcut: auth.uid == resource.data.uid
@PublicRead          // Shortcut: open read, auth write
```

### Denormalization

Keeping data in sync across collections is the hardest part of Firestore data modeling. Firemap makes it declarative: mark the source fields with `@SyncTo` and the target fields with `@DenormalizedFrom`, and the CLI generates the Cloud Functions that handle the rest.

**Real-world example: syncing author info to posts**

```typescript
import { Collection, Field, Required, SyncTo, BaseModel } from '@firemap/sdk';

@Collection('users')
class User extends BaseModel {
  @Required
  @SyncTo('posts', { field: 'authorName', sourceField: 'name' })
  @Field({ type: 'string' })
  name!: string;

  @SyncTo('posts', { field: 'authorAvatar', sourceField: 'avatarUrl' })
  @Field({ type: 'string' })
  avatarUrl!: string;
}
```

```typescript
import { Collection, Field, DenormalizedFrom, BaseModel } from '@firemap/sdk';

@Collection('posts')
class Post extends BaseModel {
  @Required
  @Field({ type: 'string' })
  title!: string;

  @Field({ type: 'reference' })
  authorRef!: string;

  @DenormalizedFrom('users', { fields: ['name', 'avatarUrl'] })
  @Field({ type: 'string' })
  authorName!: string;

  @DenormalizedFrom('users', { fields: ['name', 'avatarUrl'] })
  @Field({ type: 'string' })
  authorAvatar!: string;
}
```

**What happens at runtime:** When a user updates their `name` or `avatarUrl`, the generated Cloud Function (via `@firemap/cli`) automatically finds every post by that user and batch-updates the denormalized fields. No manual sync code needed -- your posts always show the latest author name and avatar.

You can chain multiple `@SyncTo` decorators on a single field to sync it to different collections, and a target model can receive denormalized data from multiple sources.

### Indexes & Soft Delete

```typescript
@Index(['userId', 'createdAt'])
@SoftDelete
@Collection('tasks')
class Task extends BaseModel { ... }
```

## Model API

```typescript
// CRUD
await User.create({ name: 'John', email: 'john@test.com' });
await User.findById('abc123');
await User.find({ where: { isActive: true }, limit: 10 });
await User.update('abc123', { name: 'Jane' });
await User.delete('abc123');  // Soft delete if @SoftDelete applied

// Advanced queries
await User.find({
  where: [{ field: 'age', op: '>=', value: 18 }],
  orderBy: { field: 'createdAt', direction: 'desc' },
  limit: 20,
});

// Field projection (Admin SDK only)
await User.select(['name', 'email']).find();

// Real-time streaming
const unsubscribe = User.stream({ where: { isActive: true } }, (users) => {
  console.log('Updated:', users);
});
```

## CLI (Pro)

The CLI generates Cloud Functions, indexes, and security rules from your decorators. Requires a [Pro plan](https://firemap.dev/pricing).

```bash
npm install -g @firemap/cli

firemap generate:all        # Generate everything
firemap generate:functions  # Cloud Functions for denormalization
firemap generate:indexes    # firestore.indexes.json
firemap generate:rules      # firestore.rules
firemap export              # Export schema as JSON for the web Schema Designer
```

## Web Platform

The [Firemap web platform](https://firemap.dev) provides a visual Schema Designer, Functions Dependency Graph, Database Browser, and more. You can import your code-defined schemas into the web designer:

```bash
firemap export | pbcopy  # Copy schema JSON to clipboard
```

Then paste it into the Schema Designer's **Import from Code** dialog.

## Packages

| Package | Description | License |
|---|---|---|
| [`@firemap/sdk`](https://www.npmjs.com/package/@firemap/sdk) | Decorators, Model API, validation | MIT |
| [`@firemap/cli`](https://www.npmjs.com/package/@firemap/cli) | CLI generators (functions, indexes, rules) | Pro |

## License

MIT
