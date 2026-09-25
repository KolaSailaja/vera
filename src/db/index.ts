import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const rawUrl = process.env.DATABASE_URL || 'vera.db';
const dbFilePath = rawUrl.replace(/^file:/, '');
const dbPath = path.isAbsolute(dbFilePath) ? dbFilePath : path.join(process.cwd(), dbFilePath);

// Ensure parent directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
export const sqliteClient = sqlite;
