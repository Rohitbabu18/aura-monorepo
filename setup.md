# Project Setup Guide (Backend)

This guide is written for **freshers / new developers** who are checking out this repository for the first time. Follow the steps **in order** and you should be able to run the project without errors.

---

## 1. Prerequisites

You need the following software installed on your system:

* **Node.js v18+** (JavaScript runtime)
* **npm** (comes with Node.js)
* **PostgreSQL 14+** (database used by Prisma)
* **Git** (to clone the repository)

---

## 2. Install Required Software

### 2.1 Install Node.js & npm

#### Windows / macOS

1. Go to: [https://nodejs.org](https://nodejs.org)
2. Download the **LTS version** (v18 or higher)
3. Install it using default options

#### Verify installation

```bash
node -v
npm -v
```

You should see version numbers like `v18.x` or `v20.x` or higher.

---

### 2.2 Install PostgreSQL

#### macOS (Homebrew)

```bash
brew install postgresql@14
brew services start postgresql@14
```

#### Windows

1. Download from: [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Install PostgreSQL
3. Remember:
   * **Username** (usually `postgres`)
   * **Password**
   * **Port** (default `5432`)

#### Verify PostgreSQL is running

```bash
pg_isready
```

Expected output:

```
/var/run/postgresql:5432 - accepting connections
```

---

## 3. Clone the Repository

```bash
git clone <REPO_URL>
cd mobile-backend
```

---

## 4. Install Project Dependencies

```bash
npm install
```

This installs:

* Express (Web framework)
* Prisma v7 (ORM)
* @prisma/adapter-pg (PostgreSQL adapter for Prisma 7)
* pg (PostgreSQL driver)
* bcryptjs (Password hashing)
* jsonwebtoken (JWT authentication)
* Other required libraries

---

## 5. Create the Database

### 5.1 Access PostgreSQL

```bash
psql postgres
```

### 5.2 Create database

```sql
CREATE DATABASE hospital_db;
\q
```

Or using command line:

```bash
createdb hospital_db
```

### 5.3 Verify database exists

```bash
psql -l
```

You should see `hospital_db` in the list.

---

## 6. Environment Variables (.env file)

Create a file named `.env` in the **project root**.

```env
PORT=3000
DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@127.0.0.1:5432/hospital_db"
JWT_SECRET=supersecretkey
```

### Example configurations:

**macOS (no password):**
```env
DATABASE_URL="postgresql://rohit@127.0.0.1:5432/hospital_db"
```

**Windows (with password):**
```env
DATABASE_URL="postgresql://postgres:yourpassword@127.0.0.1:5432/hospital_db"
```

⚠️ Important:

* Use `127.0.0.1` instead of `localhost` (prevents connection issues)
* Replace `<DB_USER>` with your PostgreSQL username
* Add password if your PostgreSQL requires it: `username:password@host`
* Never commit `.env` file to Git (already in `.gitignore`)

---

## 7. Prisma Setup (v7 Specific)

This project uses **Prisma 7**, which has a different configuration than older versions.

### 7.1 Configuration Files

The project has two Prisma configuration files:

1. **`prisma.config.ts`** - Contains database connection and generator settings
2. **`src/prisma/schema.prisma`** - Contains your data models

### 7.2 Validate Prisma configuration

```bash
npx prisma validate
```

Expected output:
```
✔ Prisma schema loaded from src/prisma
✔ Prisma config loaded from prisma.config.ts
```

### 7.3 Generate Prisma Client

```bash
npx prisma generate
```

This generates the Prisma Client in `src/generated/prisma/client/`.

### 7.4 Create database tables

```bash
npx prisma migrate dev --name init
```

This will:

* Create tables in PostgreSQL based on your schema
* Apply the migration
* Regenerate Prisma Client automatically

---

## 8. Project Structure

```
mobile-backend/
├── src/
│   ├── prisma/
│   │   │ 
│   │   ├── modals/
│   │   │     ├── user.prisma           # Database schema 
│   │   │     └── hospital.prisma       # Database schema
│   │   └── schema.prisma               # Database schema ( main )
│   ├── generated/
│   │   └── prisma/
│   │       └── client/         # Generated Prisma Client (auto-generated)
│   ├── lib/
│   │   └── prisma.js          # Shared Prisma instance
│   ├── controllers/
│   │   └── user.controller.js  # Business logic
│   ├── routes/
│   │   └── user.routes.js      # API routes
│   ├── app.js                  # Express app setup
│   └── server.js               # Server entry point
├── prisma.config.ts            # Prisma 7 configuration
├── package.json
├── .env                        # Environment variables (not in Git)
└── .gitignore
```

---

## 9. Run the Project

### Development mode (with auto-reload)

```bash
npm run dev
```

Server will start on:

```
http://localhost:3000
```

### Production mode

```bash
npm start
```

### Test the server

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"OK"}
```

---

## 10. Common Errors & Fixes

### ❌ Error: `Cannot find module './generated/prisma/client'`

**Cause:** Prisma Client not generated

✅ Solution:

```bash
npx prisma generate
```

---

### ❌ Error: `relation "User" does not exist`

**Cause:** Database tables not created

✅ Solution:

```bash
npx prisma migrate dev --name init
```

---

### ❌ Error: `ECONNREFUSED` or `Can't reach database server`

**Cause:** PostgreSQL not running or wrong connection string

✅ Check:

1. PostgreSQL is running:
   ```bash
   pg_isready
   ```

2. DATABASE_URL is correct in `.env`
3. Use `127.0.0.1` instead of `localhost`
4. Verify database exists:
   ```bash
   psql -l
   ```

## 11. Useful Commands (Cheat Sheet)

### Development

```bash
npm run dev                 # Start development server with auto-reload
npm start                   # Start production server
```

### Prisma Commands

```bash
npx prisma generate         # Generate Prisma Client
npx prisma migrate dev      # Create and apply new migration
npx prisma migrate reset    # Reset database (WARNING: deletes all data)
npx prisma studio           # Open Prisma Studio (database GUI)
npx prisma validate         # Validate schema and config
npx prisma db push          # Push schema to DB without migration
```

### Database Commands

```bash
psql -l                     # List all databases
psql hospital_db         # Connect to database
createdb hospital_db     # Create new database
dropdb hospital_db       # Delete database (WARNING: deletes all data)
pg_isready                  # Check if PostgreSQL is running
```

### Troubleshooting

```bash
npm install                 # Reinstall dependencies
rm -rf node_modules         # Delete node_modules
rm package-lock.json        # Delete lock file
npm install                 # Fresh install
npx prisma migrate reset    # Reset and reapply migrations
```

---

## 12. API Endpoints

Once the server is running, you can test these endpoints:

### Health Check
```bash
GET http://localhost:3000/health
```

### User Routes
```bash
POST   http://localhost:3000/api/users/register    # Register/Login user
```

### Example Request (Register/Login)

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 13. Making Schema Changes

When you need to modify the database structure:

1. **Edit** `src/prisma/schema.prisma`
   ```prisma
   model User {
     id        String   @id @default(cuid())
     email     String   @unique
     password  String
     name      String?  // Added new field
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

2. **Create migration**
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Prisma Client is auto-regenerated** after migration

---

## 14. Project Tech Stack

* **Runtime:** Node.js v18+ (ES Modules)
* **Framework:** Express.js v5
* **ORM:** Prisma v7 (with PostgreSQL adapter)
* **Database:** PostgreSQL 14+
* **Database Driver:** pg (node-postgres)
* **Authentication:** JWT (jsonwebtoken)
* **Password Hashing:** bcryptjs
* **Validation:** Zod
* **Dev Tools:** nodemon

---

## 15. Important Notes for Prisma 7

⚠️ **Prisma 7 introduces breaking changes:**

1. **Adapter Required:** Must use `@prisma/adapter-pg` with the `pg` driver
2. **No URL in Schema:** Database URL is in `prisma.config.ts`, not `schema.prisma`
3. **Shared Instance:** Always import from `src/lib/prisma.ts`, don't create new instances
4. **Client Constructor:** `new PrismaClient()` requires `{ adapter }` parameter

### How Prisma 7 Works

```javascript
// ✅ Correct (in src/lib/prisma.ts)
import { PrismaClient } from "../generated/prisma/client/index.js";
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export { prisma, pool };
```

```javascript
// ✅ In your controllers/routes
import { prisma } from '../lib/prisma.ts';

// Use prisma as normal
const users = await prisma.user.findMany();
```

---

## 16. Best Practices

✅ **DO:**
* Use Prisma migrations for all schema changes
* Import Prisma from the shared instance (`lib/prisma.js`)
* Include `.js` extensions in all ES module imports
* Keep `.env` file private (never commit to Git)
* Use `npx prisma studio` to view/edit database visually
* Run `npx prisma validate` before committing schema changes
* Test database connection before starting development

❌ **DON'T:**
* Edit database tables manually with SQL
* Create multiple PrismaClient instances
* Commit `.env` file or database credentials
* Modify generated Prisma Client files
* Use CommonJS syntax (`require`, `module.exports`)
* Put `url` in `schema.prisma` (Prisma 7 doesn't allow this)
* Skip migrations when changing schema

---

## 17. Getting Help

If you're stuck:

1. **Prisma 7 Docs:** [https://www.prisma.io/docs](https://www.prisma.io/docs)
2. **Ask your team lead** - They can help with project-specific issues

---

## 18. Quick Start (TL;DR)

For experienced developers:

```bash
# Clone and install
git clone <REPO_URL>
cd mobile-backend
npm install

# Setup database
createdb hospital_db

# Configure .env
cat > .env << EOF
DATABASE_URL="postgresql://username@127.0.0.1:5432/hospital_db"  # Please replace username by your username
PORT=3000
JWT_SECRET=supersecretkey
EOF

# Setup Prisma
npx prisma generate
npx prisma migrate dev --name init

# Run
npm run dev
```

---

## 19. Verifying Everything Works

After completing the setup, verify everything is working:

### Step 1: Check server is running
```bash
curl http://localhost:3000/health
```

Expected: `{"status":"OK"}`

### Step 2: Test database connection
```bash
npx prisma studio
```

This opens a web UI at `http://localhost:5555` where you can view your database.

### Step 3: Test API endpoint
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Expected: Success response with user data.

---

## 20. Clean Installation (If Something Goes Wrong)

If you encounter persistent issues, try a clean installation:

```bash
# 1. Stop the server (Ctrl+C)

# 2. Clean everything
rm -rf node_modules
rm -rf src/generated
rm package-lock.json

# 3. Fresh install
npm install

# 4. Regenerate Prisma
npx prisma generate

# 5. Reset database (WARNING: deletes all data)
npx prisma migrate reset

# 6. Start fresh
npm run dev
```

---
 

✅ If you followed all steps, the project should run successfully.

Happy coding! 🚀

---

**Last Updated:** December 2024  
**Prisma Version:** 7.2.0  
**Node.js Version:** 18+  
**Project Type:** ES Modules