export type AuthFailure = { message?: string; status?: number }

/**
 * Runs a Neon Auth client call and normalises failure into a value.
 *
 * The Neon Auth adapter throws on any non-2xx response (e.g. 401 for a wrong
 * password) instead of resolving with `{ error }`. Inside a transition that
 * rejection would reach the error boundary, so callers use this to handle both
 * paths the same way. Returns null on success.
 */
export async function runAuth(
  call: () => Promise<{ error: AuthFailure | null }>,
): Promise<AuthFailure | null> {
  try {
    const { error } = await call()
    return error ? { message: error.message, status: error.status } : null
  } catch (err) {
    if (err instanceof Error) {
      return { message: err.message, status: (err as Error & { status?: number }).status }
    }
    return {}
  }
}
