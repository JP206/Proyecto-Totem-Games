export interface PollUntilOptions<T> {
  task: () => Promise<T>;
  until: (result: T) => boolean | Promise<boolean>;
  attempts?: number;
  delayMs?: number;
}

export async function pollUntil<T>({
  task,
  until,
  attempts = 10,
  delayMs = 500,
}: PollUntilOptions<T>): Promise<{ success: boolean; result: T | null }> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await task();
    if (await until(result)) {
      return { success: true, result };
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { success: false, result: null };
}
