export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 10,
  delay = 500,
  operationName = 'operation'
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) {
        // If this was the last retry, throw the error
        throw error;
      }
      console.log(`[server:${operationName}] Attempt ${i + 1}/${retries} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${operationName} failed after ${retries} retries`);
} 