import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthState, NEGATIVE_TTL_MS } from '../../../../src/core/auth/authState.js';

const makeStore = (record = null) => {
  const store = {
    reads: 0,
    record,
    read() {
      store.reads += 1;
      return store.record;
    },
  };
  return store;
};

const makeClock = () => {
  let value = 1_000;
  return {
    now: () => value,
    advance: (ms) => {
      value += ms;
    },
  };
};

test('without credentials the snapshot says "not configured"', () => {
  const store = makeStore(null);
  const state = createAuthState({ store });

  assert.deepEqual(state.getSnapshot(), { configured: false, tokenVersion: 0, username: null });
});

test('with credentials it exposes the username and token version', () => {
  const store = makeStore({ username: 'admin', password_hash: 'x', token_version: 3 });
  const state = createAuthState({ store });

  assert.deepEqual(state.getSnapshot(), { configured: true, tokenVersion: 3, username: 'admin' });
});

test('once configured it never reads the file again', () => {
  const store = makeStore({ username: 'admin', password_hash: 'x', token_version: 1 });
  const clock = makeClock();
  const state = createAuthState({ store, now: clock.now });

  state.getSnapshot();
  assert.equal(store.reads, 1);

  clock.advance(NEGATIVE_TTL_MS * 10);
  state.getSnapshot();
  state.getSnapshot();

  // The middleware hot path cannot touch disk on every request.
  assert.equal(store.reads, 1);
});

test('while unconfigured it re-reads after the negative TTL', () => {
  const store = makeStore(null);
  const clock = makeClock();
  const state = createAuthState({ store, now: clock.now });

  state.getSnapshot();
  assert.equal(store.reads, 1);

  state.getSnapshot();
  assert.equal(store.reads, 1, 'no re-read within the TTL');

  clock.advance(NEGATIVE_TTL_MS);
  store.record = { username: 'admin', password_hash: 'x', token_version: 1 };

  assert.equal(state.getSnapshot().configured, true);
  assert.equal(store.reads, 2);
});

test('a cached true never degrades back to false', () => {
  const store = makeStore({ username: 'admin', password_hash: 'x', token_version: 1 });
  const clock = makeClock();
  const state = createAuthState({ store, now: clock.now });

  state.prime();
  assert.equal(state.getSnapshot().configured, true);

  // A transient read failure must not reopen the setup wizard.
  store.record = null;
  clock.advance(NEGATIVE_TTL_MS * 10);

  assert.equal(state.getSnapshot().configured, true);
});

test('a read error does not propagate: it degrades to "not configured"', () => {
  const store = {
    read() {
      throw new Error('EACCES');
    },
  };
  const state = createAuthState({ store });

  assert.deepEqual(state.getSnapshot(), { configured: false, tokenVersion: 0, username: null });
});

test('markConfigured and bumpTokenVersion update the snapshot without reading', () => {
  const store = makeStore(null);
  const state = createAuthState({ store });

  state.getSnapshot();
  const readsAfterFirst = store.reads;

  state.markConfigured({ username: 'admin', token_version: 1 });
  assert.deepEqual(state.getSnapshot(), { configured: true, tokenVersion: 1, username: 'admin' });

  state.bumpTokenVersion({ username: 'other', token_version: 2 });
  assert.deepEqual(state.getSnapshot(), { configured: true, tokenVersion: 2, username: 'other' });

  assert.equal(store.reads, readsAfterFirst);
});
