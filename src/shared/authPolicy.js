/**
 * Username and password policy.
 *
 * Dependency-free on purpose: it is imported both by the server (which really validates)
 * and by the React bundle (which only avoids a round trip). The server is the source of
 * truth — anything the client lets through is rejected again on the way in.
 */

export const USERNAME_MIN_LEN = 3;
export const USERNAME_MAX_LEN = 64;

// Without anchors so it can go straight into an HTML `pattern` attribute, which anchors
// implicitly. The server anchors it itself.
export const USERNAME_CHARSET_PATTERN = '[A-Za-z0-9._@+-]+';

export const PASSWORD_MIN_LEN = 8;
export const PASSWORD_MAX_LEN = 128;
