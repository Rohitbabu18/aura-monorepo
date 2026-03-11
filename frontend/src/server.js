import 'dotenv/config';
import { prisma, pool } from './lib/prisma.ts';

import app from './app.js';

const PORT = process.env.PORT || 3000;
 
async function startServer() {
  try {
    // Check DB connection
    await prisma.$connect();
    console.log('PostgreSQL connected');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('DB connection failed:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});