/**
 * In-process snapshot of the authentication state, so the auth middleware never reads
 * credentials.json on every request. Endpoints that change credentials update it in place;
 * periodic refresh (see TTL) catches an operator deleting the file by hand.
 *
 * No lock: Node is single-threaded per process and the server neither forks nor clusters.
 */

// Re-read at most this often. While unconfigured it brings the wizard back after a create;
// while configured it notices a deleted credentials.json without requiring a process restart.
export const NEGATIVE_TTL_MS = 5000;

/**
 * @param {{ store: { read: () => object|null }, now?: () => number }} deps
 */
export const createAuthState = ({ store, now = () => Date.now() }) => {
  let configured = null; // null = never looked
  let username = null;
  let tokenVersion = 0;
  let checkedAt = 0;

  const loadFromStore = () => {
    let record;
    try {
      record = store.read();
    } catch (error) {
      // A storage problem must not become a boot crash, and a transient failure must not
      // reopen the setup wizard on a configured instance.
      console.warn(
        '[EasyPages] Could not read the credentials:',
        error instanceof Error ? error.message : error,
      );
      checkedAt = now();
      return;
    }

    if (record) {
      configured = true;
      username = record.username;
      tokenVersion = record.token_version;
    } else {
      // Successful read of absence: the file was removed or is unusable. Sessions that
      // matched the previous snapshot must stop passing requireAuth.
      configured = false;
      username = null;
      tokenVersion = 0;
    }
    checkedAt = now();
  };

  const getSnapshot = () => {
    const stale = now() - checkedAt >= NEGATIVE_TTL_MS;
    if (configured === null || stale) {
      loadFromStore();
    }
    return { configured: Boolean(configured), tokenVersion, username };
  };

  /** Set the known state at boot so the first request does not have to read the file. */
  const prime = () => {
    configured = null;
    getSnapshot();
  };

  const markConfigured = (record) => {
    configured = true;
    username = record.username;
    tokenVersion = record.token_version;
    checkedAt = now();
  };

  /** Credentials changed: sessions on the previous version stop being valid. */
  const bumpTokenVersion = (record) => markConfigured(record);

  return { bumpTokenVersion, getSnapshot, markConfigured, prime };
};
