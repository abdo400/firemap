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

```typescript
@Collection('users')
class User extends BaseModel {
  @SyncTo('posts', { field: 'authorName', sourceField: 'name' })
  @Field({ type: 'string' })
  name!: string;
}

@Collection('posts')
class Post extends BaseModel {
  @DenormalizedFrom('users', { fields: ['name'] })
  @Field({ type: 'string' })
  authorName!: string;
}
```

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
