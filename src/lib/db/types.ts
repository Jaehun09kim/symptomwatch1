import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type AppDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbTransaction = PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
export type SqlParameter = string | number | boolean | null;

export interface RawTransaction {
  query<T>(text: string, parameters?: SqlParameter[]): Promise<T[]>;
  exec(text: string): Promise<void>;
}

export interface DatabaseHandle extends RawTransaction {
  readonly driver: "pglite" | "postgres";
  readonly db: AppDatabase;
  migrationsApplied: number;
  transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T>;
  rawTransaction<T>(fn: (tx: RawTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
