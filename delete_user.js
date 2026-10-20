/**
 * Deletes a user and all their associated entries (case_lawyers, user_lawyers,
 * user_parties, user_reminders, and any reminders left orphaned by that cascade).
 * Shared entities the user merely linked to (cases, lawyers, parties) are left
 * intact since other users may still reference them.
 *
 * Usage:
 *   node delete_user.js <user_id>              # dry run - shows what would be deleted
 *   node delete_user.js <user_id> --confirm     # actually deletes
 */
require('dotenv').config();
const { transaction, query } = require('./lib/db');

async function deleteUser(userId, confirm) {
  const user = await query('SELECT user_id, name, email FROM users WHERE user_id = $1', [userId]);
  if (user.rows.length === 0) {
    console.log(`No user found with user_id = ${userId}`);
    return;
  }
  console.log('Target user:', user.rows[0]);

  const counts = {
    case_lawyers: await query('SELECT COUNT(*) FROM case_lawyers WHERE user_id = $1', [userId]),
    user_lawyers: await query('SELECT COUNT(*) FROM user_lawyers WHERE user_id = $1', [userId]),
    user_parties: await query('SELECT COUNT(*) FROM user_parties WHERE user_id = $1', [userId]),
    user_reminders: await query('SELECT COUNT(*) FROM user_reminders WHERE user_id = $1', [userId])
  };
  console.log('Rows to remove:', Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, v.rows[0].count])
  ));

  if (!confirm) {
    console.log('\nDry run only. Re-run with --confirm to actually delete.');
    return;
  }

  await transaction(async (client) => {
    await client.query('DELETE FROM case_lawyers WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_lawyers WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_parties WHERE user_id = $1', [userId]);

    // user_reminders cascades on user delete, but do it explicitly so we can
    // clean up reminders that are left orphaned afterward.
    await client.query('DELETE FROM user_reminders WHERE user_id = $1', [userId]);
    await client.query(`
      DELETE FROM reminders r
      WHERE NOT EXISTS (
        SELECT 1 FROM user_reminders ur WHERE ur.reminder_id = r.reminder_id
      )
    `);

    await client.query('DELETE FROM users WHERE user_id = $1', [userId]);
  });

  console.log(`\nUser ${userId} and all associated entries deleted.`);
}

const userId = parseInt(process.argv[2], 10);
const confirm = process.argv.includes('--confirm');

if (!userId) {
  console.error('Usage: node delete_user.js <user_id> [--confirm]');
  process.exit(1);
}

deleteUser(userId, confirm)
  .catch((err) => {
    console.error('Failed to delete user:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
