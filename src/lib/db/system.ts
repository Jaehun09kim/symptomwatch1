import { getDatabase } from "./client";
import type { DatabaseHandle, DbTransaction } from "./types";

/** Owner access. Import locations are restricted by the system-boundary test. */
export async function withSystem<T>(
  fn: (tx: DbTransaction) => Promise<T>,
  database?: DatabaseHandle,
): Promise<T> {
  return (database ?? await getDatabase()).transaction(fn);
}
