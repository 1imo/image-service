import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * PostgreSQL connection pool
 * Configured using environment variables:
 * - DB_HOST: Database host address
 * - DB_USER: Database user
 * - DB_PASSWORD: Database password
 * - DB_PORT: Database port (defaults to 5432)
 */
export const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'media'
});

// Error handler for unexpected pool errors
pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err);
}); 