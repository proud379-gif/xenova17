#!/usr/bin/env node
'use strict';
/* XENOVA admin CLI
 *   node manage.js list-users
 *   node manage.js set-password <email> <new-password>
 *   node manage.js add-user <email> <name> <password> [admin|member] [memberId]
 *   node manage.js make-admin <email>
 * Run it while the server is stopped or running — SQLite handles both.
 */
const D = require('./db');
const [cmd, ...a] = process.argv.slice(2);

(async () => {
  switch (cmd) {
    case 'list-users': {
      const rows = D.db.prepare('SELECT id,email,name,role FROM users ORDER BY created_at').all();
      console.table(rows);
      break;
    }
    case 'set-password': {
      const [email, pw] = a;
      if (!email || !pw || pw.length < 6) throw new Error('usage: set-password <email> <password (6+ chars)>');
      const u = D.findUserByEmail(email);
      if (!u) throw new Error('user not found');
      D.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await D.hashPassword(pw), u.id);
      D.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
      console.log('password updated for', u.email);
      break;
    }
    case 'add-user': {
      const [email, name, pw, role = 'member', memberId] = a;
      if (!email || !name || !pw || pw.length < 6) throw new Error('usage: add-user <email> <name> <password> [admin|member] [memberId]');
      if (!['admin', 'member'].includes(role)) throw new Error('role must be admin or member');
      const id = memberId || 'u_' + require('crypto').randomBytes(8).toString('hex');
      if (D.findUserById(id)) throw new Error('that id already has an account');
      await D.createUser({ id, email, name, password: pw, role });
      console.log('created', email, '(' + role + ')', 'id =', id);
      if (memberId) console.log('linked to team member profile', memberId);
      break;
    }
    case 'make-admin': {
      const u = D.findUserByEmail(a[0] || '');
      if (!u) throw new Error('user not found');
      D.db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(u.id);
      console.log(u.email, 'is now admin');
      break;
    }
    default:
      console.log('commands: list-users | set-password | add-user | make-admin');
  }
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
