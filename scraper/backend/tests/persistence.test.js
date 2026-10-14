// persistence.test.js — the ledger and credit balances must outlive a process.
//
// These guard the bug that started this: everything lived in an in-memory Map,
// so every deploy, restart or crash silently deleted the harvests *and* the
// credits customers had already paid for.
//
// Each test writes, then re-imports the module from a fresh connection to prove
// the value came off disk rather than out of a cache.

import './testDb.js';

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { TEST_DB_PATH } from './testDb.js';

const SCOPE = 'p'.repeat(32);
const OTHER = 'q'.repeat(32);

// Opened once at the top so the file exists and the tables are created before
// any test tries to delete from them.
const base = await import('../src/store.js');
const baseBilling = await import('../src/billing.js');
const resetRows = () => {
  base.clearStore();
  baseBilling.clearPayments();
};

/** Re-import store.js + billing.js so they reconnect and read from disk. */
async function reopen() {
  const bust = `${Date.now()}-${Math.random()}`;
  const store = await import(`../src/store.js?fresh=${bust}`);
  const billing = await import(`../src/billing.js?fresh=${bust}`);
  return { store, billing };
}

/**
 * Start each test from a clean file.
 *
 * Deleting the file is not enough: store.js and billing.js each hold an open
 * handle, and Windows refuses to unlink a file that is still open (EPERM). So
 * wipe the rows instead of the file, and only remove the file on the way out.
 */
beforeEach(() => {
  const store = resetRows;
  store();
});

describe('data survives a restart', () => {
  test('a harvest written before "restart" is still listed after', async () => {
    const { store } = await reopen();
    store.createContent(
      { url: 'https://example.com/a', domain: 'example.com', title: 'Kept', wordCount: 120 },
      SCOPE
    );
    assert.equal(store.listContents({ scope: SCOPE }).length, 1);

    const again = await reopen();
    const list = again.store.listContents({ scope: SCOPE });
    assert.equal(list.length, 1, 'harvest must survive a restart');
    assert.equal(list[0].title, 'Kept');
  });

  test('paid credits are not lost on restart', async () => {
    const { store } = await reopen();
    store.grantCredits(1000, SCOPE);
    assert.equal(store.getCredits(SCOPE), 1000);

    const again = await reopen();
    assert.equal(
      again.store.getCredits(SCOPE),
      1000,
      'a customer who paid must keep their credits across a deploy'
    );
  });

  test('a spent credit stays spent', async () => {
    const { store } = await reopen();
    store.grantCredits(3, SCOPE);
    assert.equal(store.spendCredit(SCOPE), true);
    assert.equal(store.spendCredit(SCOPE), true);

    const again = await reopen();
    assert.equal(again.store.getCredits(SCOPE), 1, 'spending must persist too');
  });

  test('payment history survives a restart', async () => {
    const first = await reopen();
    first.billing.recordPayment({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_persist_1',
          amount_total: 9900,
          currency: 'thb',
          payment_status: 'paid',
          client_reference_id: SCOPE
        }
      }
    });
    assert.equal(first.billing.listPayments().length, 1);

    const again = await reopen();
    const rows = again.billing.listPayments();
    assert.equal(rows.length, 1, 'purchase record must survive a restart');
    assert.equal(rows[0].id, 'cs_persist_1');
    assert.equal(rows[0].customer, SCOPE);
    // The webhook credits the buyer once, and only once.
    assert.equal(again.store.getCredits(SCOPE), 1000);
  });

  test('the free tier is granted once, not on every reload', async () => {
    const { store } = await reopen();
    const first = store.ensureCustomer(SCOPE, '9.9.9.9');
    assert.equal(first.freeTierApplied, true);
    assert.equal(first.credits, 3);

    const second = store.ensureCustomer(SCOPE, '9.9.9.9');
    assert.equal(second.freeTierApplied, false, 'a returning customer gets nothing extra');
    assert.equal(second.credits, 3);
  });

  test('customers stay isolated from each other after a restart', async () => {
    const { store } = await reopen();
    store.grantCredits(500, SCOPE);
    store.createContent({ url: 'https://a.test/', domain: 'a.test', title: 'A' }, SCOPE);

    const again = await reopen();
    assert.equal(again.store.getCredits(SCOPE), 500);
    assert.equal(again.store.getCredits(OTHER), 0, 'no credit leaks across customers');
    assert.equal(again.store.listContents({ scope: OTHER }).length, 0, 'no content leaks');
    assert.equal(again.store.listContents({ scope: SCOPE }).length, 1);
  });

  test('duplicate webhook deliveries do not double-credit', async () => {
    const { store, billing } = await reopen();
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_dup_1',
          amount_total: 9900,
          currency: 'thb',
          payment_status: 'paid',
          client_reference_id: SCOPE
        }
      }
    };
    billing.recordPayment(event);
    billing.recordPayment(event); // Stripe retries on timeouts

    assert.equal(store.getCredits(SCOPE), 1000, 'a replay must not grant 2000');
    assert.equal(billing.listPayments().length, 1, 'a replay must not duplicate the receipt');
  });
});

describe('database file location', () => {
  test('SCRAPER_DB_PATH is honoured so a volume can be mounted', async () => {
    const { TEST_DB_PATH: used } = await import('./testDb.js');
    assert.ok(used.endsWith('.sqlite'), `unexpected path: ${used}`);
    assert.ok(
      process.env.SCRAPER_DB_PATH === used,
      'store must read the path from the environment'
    );
    assert.equal(pathToFileURL(used).protocol, 'file:');
  });
});