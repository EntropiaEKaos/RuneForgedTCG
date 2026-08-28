/** Runs more jobs than a database pool can hold without pre-acquiring clients. */
export async function runPooledWorkers<T>(count: number, worker: (index: number) => Promise<T>): Promise<T[]> {
  if (!Number.isInteger(count) || count < 0 || count > 10_000) throw new Error("Invalid worker count");
  return Promise.all(Array.from({ length: count }, (_, index) => worker(index)));
}
