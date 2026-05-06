import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

export const pgPool =
  (() => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      keepAlive: true,
    });

    return pool;
  })();

export const db = drizzle(pgPool, { schema });