import PrismaClientPkg from "../generated/prisma/client/index.js";
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import pg from 'pg';

const { PrismaClient } = PrismaClientPkg;

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
