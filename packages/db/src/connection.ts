import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema.js";

export type SanctuaryDb = PostgresJsDatabase<typeof schema>;

export function createPostgresClient(connectionString: string) {
  return postgres(connectionString);
}

export function createSanctuaryDb(connectionString: string): SanctuaryDb {
  return drizzle(createPostgresClient(connectionString), { schema });
}
