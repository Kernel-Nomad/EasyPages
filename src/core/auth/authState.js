/**
 * In-process snapshot of the authentication state, so the auth middleware never reads
 * credentials.json on the hot path. Only the endpoints that change it invalidate this.
 *
 * No lock: Node is single-threaded per process and the server neither forks nor clusters.
 */

// While unconfigured the store is re-read at most every N ms, so deleting the file by hand
// brings the wizard back without a restart. Once configured, only the endpoints update it.
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
    let record = null;
    try {
      record = store.read();
    } catch (error) {
      // A storage problem must not become a boot crash.
      console.warn(
        '[EasyPages] Could not read the credentials:',
        error instanceof Error ? error.message : error,
      );
    }

    // A cached `true` never degrades back to `false`: a transient read failure must not
    // reopen the setup wizard on a configured instance.
    if (record) {
      configured = true;
      username = record.username;
      tokenVersion = record.token_version;
    } else if (!configured) {
      configured = false;
      username = null;
      tokenVersion = 0;
    }
    checkedAt = now();
  };

  const getSnapshot = () => {
    const stale = now() - checkedAt >= NEGATIVE_TTL_MS;
    if (configured === null || (configured === false && stale)) {
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
