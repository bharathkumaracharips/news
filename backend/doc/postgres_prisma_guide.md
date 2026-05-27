# 🐘 PostgreSQL & ◭ Prisma Guide

This guide covers setting up, migrating, and querying the database in the News backend service.

---

## 🏗️ 1. PostgreSQL Local Setup

### macOS Installation
The easiest way to run PostgreSQL natively on macOS is using **Homebrew**:

1. **Install PostgreSQL**:
   ```bash
   brew install postgresql@16
   ```
2. **Start the PostgreSQL Service**:
   ```bash
   brew services start postgresql@16
   ```

### Database Creation
Using standard terminal interactive console (`psql`) or a visual GUI (like pgAdmin):

1. **Open PostgreSQL CLI**:
   ```bash
   psql postgres
   ```
2. **Create the Project Database**:
   ```sql
   CREATE DATABASE newsapp;
   ```
3. **Exit Session**:
   ```sql
   \q
   ```

---

## ⚡️ 2. Environment Settings
Prisma connects to your database via environment configurations defined inside the [backend/.env](file:///Users/psbharathkumarachari/news/backend/.env) file:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/newsapp"
```
*Replace `YOUR_PASSWORD` with your PostgreSQL database password.*

---

## ◭ 3. Using Prisma in the Backend

Because this project utilizes **Prisma 7**, datasource connections are configured within [prisma.config.ts](file:///Users/psbharathkumarachari/news/backend/prisma.config.ts) instead of standard schema configurations:

```typescript
// prisma.config.ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

### Core Workflows

#### 🔄 Apply Migrations (Sync Schemas)
When schema files are updated (e.g. adding columns or new models inside [schema.prisma](file:///Users/psbharathkumarachari/news/backend/prisma/schema.prisma)), execute:
```bash
npx prisma migrate dev --name name_your_migration
```
*This synchronizes PostgreSQL relational structures instantly and recreates the type-safe client library.*

#### 🛠️ Generate Prisma Client (Compile-Time Types)
To rebuild typescript auto-completion client definitions:
```bash
npx prisma generate
```

#### 🖥️ Launch Prisma Studio (Lightweight Visual GUI)
Open a fully reactive visual GUI editor in your browser to inspect database entries, delete items, and test manual rows:
```bash
npx prisma studio
```
*Visualizer runs on [http://localhost:5555](http://localhost:5555).*

---

## 📝 4. Client Querying API
Inside backend modules, database queries are issued through the global connection hook exported from `src/config/db.ts`:

```typescript
import prisma from '../config/db';

// Fetching all items matching properties
const articles = await prisma.article.findMany({
  where: {
    isTopStory: true
  },
  include: {
    category: true
  }
});
```
