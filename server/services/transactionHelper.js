/**
 * Transaction Helper — MongoDB multi-document transaction wrapper
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Provides a safe, reusable wrapper for Mongoose transactions.
 * If the callback throws, the transaction is automatically aborted.
 * If it succeeds, the transaction is committed.
 *
 * Usage:
 *   const { withTransaction } = require('./transactionHelper');
 *   const result = await withTransaction(async (session) => {
 *     await Model.create([{ ... }], { session });
 *     await OtherModel.updateOne({ ... }, { ... }, { session });
 *     return { success: true };
 *   });
 *
 * Note: Requires a MongoDB replica set. For local dev without replica set,
 * the helper falls back to running the function without a session.
 */
const mongoose = require('mongoose');

/**
 * Execute `fn` inside a MongoDB transaction.
 * @param {Function} fn - async function receiving (session) as argument
 * @returns {*} whatever fn returns
 */
async function withTransaction(fn) {
  // Check if we're connected to a replica set (transactions require it)
  const topology = mongoose.connection?.client?.topology;
  const isReplicaSet = topology?.description?.type === 'ReplicaSetWithPrimary' ||
                       topology?.description?.type === 'ReplicaSetNoPrimary' ||
                       topology?.s?.description?.type === 'ReplicaSetWithPrimary';

  if (!isReplicaSet) {
    // Standalone MongoDB — run without transaction (dev mode)
    // Log once per process lifetime
    if (!withTransaction._warnedStandalone) {
      console.warn('[TransactionHelper] ⚠️  Standalone MongoDB detected — transactions disabled. Use a replica set for production safety.');
      withTransaction._warnedStandalone = true;
    }
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    // Transaction was automatically aborted by session.withTransaction()
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { withTransaction };
