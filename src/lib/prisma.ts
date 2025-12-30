import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import pg from 'pg';

// Create PostgreSQL connection pool
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL 
});

const adapter = new PrismaPg(pool);

// Create a single PrismaClient instance
const prisma = new PrismaClient({ 
  adapter: adapter 
});

export { prisma, pool };