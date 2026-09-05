type FirebaseTokenUser = {
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

export async function getTokenWithRetry(
  user: FirebaseTokenUser,
  forceRefresh = false,
  maxAttempts = 3,
  delay = 100,
): Promise<string> {
  let lastError: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await user.getIdToken(forceRefresh);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
