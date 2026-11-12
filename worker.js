const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('');

async function signStr(key, msg){
  const k = await crypto.subtle.importKey('raw', enc.encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
async function signBytes(keyBytes, msg){
  const k = await crypto.subtle.importKey('raw', keyBytes, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
function hexToBytes(h){const a=new Uint8Array(h.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(h.substr(i*2,2),16);return a;}

async function verifyInitData(initData, botToken){
  if(!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash'); if(!hash) return null;
  params.delete('hash');
  const dcs = [...params.entries()].sort(([a],[b]) => a<b?-1:1).map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = await signBytes(enc.encode('WebAppData'), botToken);
  const secretBytes = hexToBytes(secret);
  const calc = await signBytes(secretBytes, dcs);
  if(calc !== hash) return null;
  const authDate = parseInt(params.get('auth_date')||'0', 10);
  if(!authDate || Math.floor(Date.now()/1000) - authDate > 86400) return null;
  const user = JSON.parse(params.get('user')||'null');
  if(!user || !user.id) return null;
  return { user, startParam: params.get('start_param')||null };
}
async function authUser(req, env){
  const h = req.headers.get('Authorization')||'';
  const initData = h.startsWith('tma ') ? h.slice(4) : '';
  return await verifyInitData(initData, env.BOT_TOKEN);
}
async function authAdmin(req, env){
  const t = req.headers.get('X-Admin-Token')||'';
  if(!t) return null;
  const [payload, sig] = t.split('.');
  if(!payload || !sig) return null;
  const expected = await signStr(env.ADMIN_SECRET, payload);
  if(expected !== sig) return null;
  try { const data = JSON.parse(atob(payload)); if(data.exp < Date.now()) return null; return data; } catch(e){ return null; }
}

const DAY = 86400000;
const todayUtc = () => new Date().toISOString().slice(0,10);
const yestUtc = () => new Date(Date.now()-DAY).toISOString().slice(0,10);
function nextCycleDate(from){
  const d = new Date(from);
  for(let i=0;i<14;i++){
    d.setUTCDate(d.getUTCDate()+1);
    const day = d.getUTCDay();
    if(day===3 || day===6) return d.toISOString().slice(0,10);
  }
  return d.toISOString().slice(0,10);
}

/* ---- Network bridge (fire-and-forget to the separate affiliate network) ---- */
async function networkCall(env, path, body){
  if(!env.NETWORK_URL || !env.NETWORK_SECRET) return;
  try {
    await fetch(env.NETWORK_URL + path, {
      method:'POST',
      headers:{'Content-Type':'application/json','X-Network-Secret': env.NETWORK_SECRET},
      body: JSON.stringify(body)
    });
  } catch(e){ /* fail silently — network outages must not break the app */ }
}

/* ---- Referral activation for normal users ---- */
async function creditOneTime(env, referrerId, refereeId){
  const ref = await env.DB.prepare(`SELECT * FROM referrals WHERE referrer_id=? AND referee_id=? AND activated=0`).bind(referrerId, refereeId).first();
  if(!ref) return;
  const u = await env.DB.prepare(`SELECT earned_total FROM users WHERE telegram_id=?`).bind(refereeId).first();
  if(!u || u.earned_total < 650) return;
  const referrer = await env.DB.prepare(`SELECT 1 FROM users WHERE telegram_id=?`).bind(referrerId).first();
  if(!referrer) return;
  await env.DB.batch([
    env.DB.prepare(`UPDATE referrals SET activated=1, activated_at=datetime('now') WHERE referrer_id=? AND referee_id=?`).bind(referrerId, refereeId),
    env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(referrerId, 100, 'referral_100', String(refereeId)),
    env.DB.prepare(`UPDATE users SET balance=balance+100, earned_total=earned_total+100 WHERE telegram_id=?`).bind(referrerId)
  ]);
}
async function checkReferralActivation(env, refereeId){
  const u = await env.DB.prepare(`SELECT earned_total FROM users WHERE telegram_id=?`).bind(refereeId).first();
  if(!u || u.earned_total < 650) return;
  const refs = await env.DB.prepare(`SELECT referrer_id FROM referrals WHERE referee_id=? AND activated=0`).bind(refereeId).all();
  for(const r of refs.results){
    await creditOneTime(env, r.referrer_id, refereeId);
  }
}

/* ---- ₦5 cycle settlement for normal users ---- */
async function settleCycles(env, userId){
  const past = await env.DB.prepare(
    `SELECT DISTINCT cycle_date FROM payouts WHERE referrer_id=? AND cycle_date IS NOT NULL AND cycle_date < ? AND status='paid'`
  ).bind(userId, todayUtc()).all();
  for(const row of past.results){
    const settled = await env.DB.prepare(`SELECT 1 FROM cycle_settlements WHERE beneficiary_id=? AND cycle_date=?`).bind(userId, row.cycle_date).first();
    if(settled) continue;
    const activated = await env.DB.prepare(
      `SELECT COUNT(*) c FROM referrals WHERE referrer_id=? AND activated=1 AND expires_at > datetime('now')`
    ).bind(userId).first();
    if((activated.c || 0) < 100){
      await env.DB.prepare(`INSERT INTO cycle_settlements (beneficiary_id,cycle_date,referral_count,amount_ngn) VALUES (?,?,?,?)`).bind(userId, row.cycle_date, 0, 0).run();
      continue;
    }
    const count = await env.DB.prepare(
      `SELECT COUNT(*) c FROM payouts WHERE referrer_id=? AND cycle_date=? AND status='paid'`
    ).bind(userId, row.cycle_date).first();
    const cnt = count.c || 0;
    if(cnt >= 100){
      const amt = cnt * 5;
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO cycle_settlements (beneficiary_id,cycle_date,referral_count,amount_ngn) VALUES (?,?,?,?)`).bind(userId, row.cycle_date, cnt, amt),
        env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(userId, amt, 'cycle_bonus', row.cycle_date),
        env.DB.prepare(`UPDATE users SET balance=balance+?, earned_total=earned_total+? WHERE telegram_id=?`).bind(amt, amt, userId)
      ]);
    } else {
      await env.DB.prepare(`INSERT INTO cycle_settlements (beneficiary_id,cycle_date,referral_count,amount_ngn) VALUES (?,?,?,?)`).bind(userId, row.cycle_date, cnt, 0).run();
    }
  }
}

/* ---- Router ---- */
export default {
  async fetch(req, env){
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': env.APP_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Admin-Token',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    };
    if(req.method === 'OPTIONS') return new Response(null, {headers:cors});
    try {
      if(url.pathname === '/postback') return await postback(req, env);
      if(url.pathname === '/admin/login' && req.method === 'POST') return await adminLogin(req, env, cors);

      if(url.pathname === '/api/sync' && req.method === 'POST') return await userSync(req, env, cors);
      if(url.pathname === '/api/me') return await userMe(req, env, cors);
      if(url.pathname === '/api/checkin' && req.method === 'POST') return await userCheckin(req, env, cors);
      if(url.pathname === '/api/offers') return await userOffers(req, env, cors);
      if(url.pathname === '/api/click' && req.method === 'POST') return await userClick(req, env, cors);
      if(url.pathname === '/api/wallet' && req.method === 'POST') return await userWallet(req, env, cors);
      if(url.pathname === '/api/withdraw' && req.method === 'POST') return await userWithdraw(req, env, cors);
      if(url.pathname === '/api/messages') return await userMessages(req, env, cors);
      if(url.pathname === '/api/messages/read' && req.method === 'POST') return await userMessagesRead(req, env, cors);

      const admin = await authAdmin(req, env);
      if(url.pathname.startsWith('/admin/') && !admin) return Response.json({error:'auth'}, {status:401, headers:cors});
      if(url.pathname === '/admin/stats') return await adminStats(env, cors);
      if(url.pathname === '/admin/users') return await adminUsers(req, env, url, cors);
      if(url.pathname === '/admin/ban' && req.method === 'POST') return await adminBan(req, env, cors);
      if(url.pathname === '/admin/delete' && req.method === 'POST') return await adminDelete(req, env, cors);
      if(url.pathname === '/admin/payouts') return await adminPayouts(env, cors);
      if(url.pathname === '/admin/payout' && req.method === 'POST') return await adminPayoutAction(req, env, cors);
      if(url.pathname === '/admin/messages') return await adminMessagesList(env, cors);
      if(url.pathname === '/admin/message' && req.method === 'POST') return await adminMessageSend(req, env, cors);
      if(url.pathname === '/admin/offers') return await adminOffersList(env, cors);
      if(url.pathname === '/admin/offer/add' && req.method === 'POST') return await adminOfferAdd(req, env, cors);

      return new Response('not found', {status:404, headers:cors});
    } catch(e){
      return Response.json({error:'server', detail:String(e)}, {status:500, headers:cors});
    }
  }
};

/* ============ USER ============ */
async function userSync(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const uid = v.user.id;
  await env.DB.prepare(
    `INSERT INTO users (telegram_id,username,first_name) VALUES (?,?,?)
     ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name`
  ).bind(uid, v.user.username||null, v.user.first_name||null).run();

  const sp = v.startParam;
  if(sp && sp !== String(uid)){
    if(/^\d+$/.test(sp)){
      const refId = parseInt(sp, 10);
      const exists = await env.DB.prepare(`SELECT 1 FROM referrals WHERE referee_id=?`).bind(uid).first();
      if(!exists && refId !== uid){
        const referrer = await env.DB.prepare(`SELECT 1 FROM users WHERE telegram_id=?`).bind(refId).first();
        if(referrer){
          const expiresAt = new Date(Date.now() + 365*DAY).toISOString();
          await env.DB.prepare(`INSERT INTO referrals (referrer_id,referee_id,expires_at) VALUES (?,?,?)`).bind(refId, uid, expiresAt).run();
        }
      }
    } else {
      // Non-numeric = affiliate code from the separate network
      await networkCall(env, '/api/track-signup', { app_id: 'cryptonaira', affiliate_code: sp, user_telegram_id: uid });
    }
  }
  return Response.json({ok:true}, {headers:cors});
}

async function userMe(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const uid = v.user.id;
  const u = await env.DB.prepare(`SELECT * FROM users WHERE telegram_id=?`).bind(uid).first();
  if(u && u.banned) return Response.json({error:'banned'}, {status:403, headers:cors});
  await settleCycles(env, uid);
  const [u2, w, refs, hist, unread] = await Promise.all([
    env.DB.prepare(`SELECT * FROM users WHERE telegram_id=?`).bind(uid).first(),
    env.DB.prepare(`SELECT * FROM wallets WHERE telegram_id=?`).bind(uid).first(),
    env.DB.prepare(`SELECT activated, COUNT(*) c FROM referrals WHERE referrer_id=? GROUP BY activated`).bind(uid).all(),
    env.DB.prepare(`SELECT delta,reason,created_at FROM ledger WHERE owner_id=? ORDER BY id DESC LIMIT 30`).bind(uid).all(),
    env.DB.prepare(`SELECT COUNT(*) c FROM messages m WHERE NOT EXISTS (SELECT 1 FROM message_reads r WHERE r.message_id=m.id AND r.reader_id=?)`).bind(uid).first()
  ]);
  const rc = refs.results.reduce((a,r) => { a[r.activated?'qualified':'pending'] = r.c; return a; }, {});
  return Response.json({
    uid, username: v.user.username||v.user.first_name,
    balance: u2?.balance ?? 0, earned_total: u2?.earned_total ?? 0,
    tasks_done: u2?.tasks_done ?? 0, streak: u2?.streak ?? 0,
    last_checkin: u2?.last_checkin ?? null,
    wallet: w || null,
    referrals: rc,
    history: hist.results,
    unread: unread?.c || 0
  }, {headers:cors});
}

async function userCheckin(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const uid = v.user.id, day = todayUtc();
  const u = await env.DB.prepare(`SELECT streak,last_checkin FROM users WHERE telegram_id=?`).bind(uid).first();
  if(u?.last_checkin === day) return Response.json({error:'already'}, {status:409, headers:cors});
  let streak = (u?.last_checkin === yestUtc()) ? (u.streak||0) : 0;
  streak = streak >= 7 ? 1 : streak + 1;
  const amount = streak === 7 ? 52 : 13;
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO checkins (telegram_id,day,amount) VALUES (?,?,?)`).bind(uid, day, amount),
    env.DB.prepare(`UPDATE users SET streak=?,last_checkin=?,balance=balance+?,earned_total=earned_total+? WHERE telegram_id=?`).bind(streak, day, amount, amount, uid),
    env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(uid, amount, 'checkin', 'chk_'+day)
  ]);
  await checkReferralActivation(env, uid);
  const fresh = await env.DB.prepare(`SELECT earned_total FROM users WHERE telegram_id=?`).bind(uid).first();
  await networkCall(env, '/api/track-earn', { app_id: 'cryptonaira', user_telegram_id: uid, new_earned_total: fresh?.earned_total || 0 });
  return Response.json({ok:true, amount, streak}, {headers:cors});
}

async function userOffers(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const rows = await env.DB.prepare(`SELECT id,title,subtitle,payout_ngn FROM offers WHERE active=1`).all();
  return Response.json({offers: rows.results}, {headers:cors});
}

async function userClick(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const {offerId} = await req.json().catch(()=>({}));
  if(!offerId) return Response.json({error:'offerId'}, {status:400, headers:cors});
  const o = await env.DB.prepare(`SELECT * FROM offers WHERE id=? AND active=1`).bind(offerId).first();
  if(!o) return Response.json({error:'not_found'}, {status:404, headers:cors});
  const subId = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO clicks (sub_id,telegram_id,offer_id,payout_ngn) VALUES (?,?,?,?)`).bind(subId, v.user.id, offerId, o.payout_ngn).run();
  const url = (o.url_template||'').replace('{sub}', encodeURIComponent(subId));
  return Response.json({subId, url}, {headers:cors});
}

async function userWallet(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const {bankName, acctNum, acctName} = await req.json().catch(()=>({}));
  if(!bankName || !/^\d{10}$/.test(acctNum||'') || !acctName) return Response.json({error:'invalid'}, {status:400, headers:cors});
  await env.DB.prepare(
    `INSERT INTO wallets (telegram_id,bank_name,acct_num,acct_name,updated_at) VALUES (?,?,?,?,datetime('now'))
     ON CONFLICT(telegram_id) DO UPDATE SET bank_name=excluded.bank_name, acct_num=excluded.acct_num, acct_name=excluded.acct_name, updated_at=datetime('now')`
  ).bind(v.user.id, bankName, acctNum, acctName).run();
  return Response.json({ok:true}, {headers:cors});
}

async function userWithdraw(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const uid = v.user.id;
  const u = await env.DB.prepare(`SELECT balance FROM users WHERE telegram_id=?`).bind(uid).first();
  const w = await env.DB.prepare(`SELECT * FROM wallets WHERE telegram_id=?`).bind(uid).first();
  if(!w || !w.acct_num) return Response.json({error:'wallet'}, {status:400, headers:cors});
  if((u?.balance||0) < 2000) return Response.json({error:'min'}, {status:400, headers:cors});
  const open = await env.DB.prepare(`SELECT id FROM payouts WHERE owner_id=? AND status='requested'`).bind(uid).first();
  if(open) return Response.json({error:'pending'}, {status:409, headers:cors});
  const amount = u.balance;
  const id = crypto.randomUUID();
  const cycleDate = nextCycleDate(new Date());
  const ref = await env.DB.prepare(`SELECT referrer_id FROM referrals WHERE referee_id=? AND activated=1 AND expires_at > datetime('now')`).bind(uid).first();
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET balance=balance-? WHERE telegram_id=? AND balance>=?`).bind(amount, uid, amount),
    env.DB.prepare(`INSERT INTO payouts (id,owner_id,amount_ngn,cycle_date,referrer_id) VALUES (?,?,?,?,?)`).bind(id, uid, amount, cycleDate, ref?.referrer_id || null),
    env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(uid, -amount, 'withdraw_requested', id)
  ]);
  return Response.json({ok:true, amount}, {headers:cors});
}

async function userMessages(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const rows = await env.DB.prepare(`SELECT id,title,body,created_at FROM messages ORDER BY created_at DESC LIMIT 30`).all();
  return Response.json({messages: rows.results}, {headers:cors});
}
async function userMessagesRead(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const msgs = await env.DB.prepare(`SELECT id FROM messages`).all();
  for(const m of msgs.results){
    await env.DB.prepare(`INSERT OR IGNORE INTO message_reads (message_id,reader_id) VALUES (?,?)`).bind(m.id, v.user.id).run();
  }
  return Response.json({ok:true}, {headers:cors});
}

/* ============ ADMIN ============ */
async function adminLogin(req, env, cors){
  const body = await req.json().catch(()=>({}));
  if(body.password !== env.ADMIN_PASSWORD) return Response.json({error:'auth'}, {status:401, headers:cors});
  const payload = btoa(JSON.stringify({role:'admin', exp: Date.now()+86400000}));
  const sig = await signStr(env.ADMIN_SECRET, payload);
  return Response.json({token: payload+'.'+sig}, {headers:cors});
}

async function adminStats(env, cors){
  const [users, credited, paid, pending, balances] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) c FROM users`).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(earned_total),0) s FROM users`).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(amount_ngn),0) s, COUNT(*) c FROM payouts WHERE status='paid'`).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(amount_ngn),0) s, COUNT(*) c FROM payouts WHERE status='requested'`).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(balance),0) s FROM users`).first()
  ]);
  const totalCredited = credited?.s || 0;
  const totalPaid = paid?.s || 0;
  const pendingPaid = pending?.s || 0;
  const balanceHeld = balances?.s || 0;
  return Response.json({
    totalUsers: users?.c || 0,
    totalCredited,
    totalPaid,
    totalPaidCount: paid?.c || 0,
    pendingPayouts: pendingPaid,
    pendingCount: pending?.c || 0,
    currentBalance: balanceHeld,
    platformNet: totalCredited - totalPaid - pendingPaid - balanceHeld
  }, {headers:cors});
}

async function adminUsers(req, env, url, cors){
  const page = Math.max(1, parseInt(url.searchParams.get('page')||'1',10));
  const q = (url.searchParams.get('q')||'').trim();
  const limit = 100, offset = (page-1)*limit;
  let where = '', params = [];
  if(q){
    where = `WHERE (username LIKE ? OR CAST(telegram_id AS TEXT) LIKE ?)`;
    params = ['%'+q+'%', '%'+q+'%'];
  }
  const rows = await env.DB.prepare(`SELECT telegram_id,username,first_name,balance,earned_total,tasks_done,banned FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all();
  const total = await env.DB.prepare(`SELECT COUNT(*) c FROM users ${where}`).bind(...params).first();
  return Response.json({users: rows.results, page, pages: Math.ceil((total?.c||0)/limit)||1}, {headers:cors});
}

async function adminBan(req, env, cors){
  const {telegram_id, banned} = await req.json().catch(()=>({}));
  if(!telegram_id) return Response.json({error:'invalid'}, {status:400, headers:cors});
  await env.DB.prepare(`UPDATE users SET banned=? WHERE telegram_id=?`).bind(banned?1:0, telegram_id).run();
  return Response.json({ok:true}, {headers:cors});
}

async function adminDelete(req, env, cors){
  const {telegram_id} = await req.json().catch(()=>({}));
  if(!telegram_id) return Response.json({error:'invalid'}, {status:400, headers:cors});
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM wallets WHERE telegram_id=?`).bind(telegram_id),
    env.DB.prepare(`DELETE FROM checkins WHERE telegram_id=?`).bind(telegram_id),
    env.DB.prepare(`DELETE FROM referrals WHERE referrer_id=? OR referee_id=?`).bind(telegram_id, telegram_id),
    env.DB.prepare(`DELETE FROM users WHERE telegram_id=?`).bind(telegram_id)
  ]);
  return Response.json({ok:true}, {headers:cors});
}

async function adminPayouts(env, cors){
  const rows = await env.DB.prepare(
    `SELECT p.id,p.owner_id as telegram_id,p.amount_ngn,p.status,p.created_at,
     u.username, u.first_name,
     w.bank_name, w.acct_num, w.acct_name
     FROM payouts p
     LEFT JOIN users u ON u.telegram_id=p.owner_id
     LEFT JOIN wallets w ON w.telegram_id=p.owner_id
     ORDER BY p.created_at DESC LIMIT 200`
  ).all();
  return Response.json({payouts: rows.results}, {headers:cors});
}

async function adminPayoutAction(req, env, cors){
  const {id, status} = await req.json().catch(()=>({}));
  if(!id || !['paid','rejected'].includes(status)) return Response.json({error:'invalid'}, {status:400, headers:cors});
  const p = await env.DB.prepare(`SELECT * FROM payouts WHERE id=?`).bind(id).first();
  if(!p) return Response.json({error:'not_found'}, {status:404, headers:cors});
  if(p.status !== 'requested') return Response.json({error:'already_processed'}, {status:409, headers:cors});
  if(status === 'paid'){
    await env.DB.batch([
      env.DB.prepare(`UPDATE payouts SET status='paid', paid_at=datetime('now') WHERE id=?`).bind(id),
      env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(p.owner_id, 0, 'payout_paid', id)
    ]);
    await networkCall(env, '/api/track-withdrawal', { app_id: 'cryptonaira', user_telegram_id: p.owner_id, cycle_date: p.cycle_date, amount: p.amount_ngn });
  } else {
    await env.DB.batch([
      env.DB.prepare(`UPDATE payouts SET status='rejected', rejected_at=datetime('now') WHERE id=?`).bind(id),
      env.DB.prepare(`UPDATE users SET balance=balance+? WHERE telegram_id=?`).bind(p.amount_ngn, p.owner_id),
      env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(p.owner_id, p.amount_ngn, 'payout_refunded', id)
    ]);
  }
  return Response.json({ok:true}, {headers:cors});
}

async function adminMessagesList(env, cors){
  const rows = await env.DB.prepare(`SELECT id,title,body,created_at FROM messages ORDER BY created_at DESC LIMIT 100`).all();
  return Response.json({messages: rows.results}, {headers:cors});
}
async function adminMessageSend(req, env, cors){
  const {title, body} = await req.json().catch(()=>({}));
  if(!body) return Response.json({error:'invalid'}, {status:400, headers:cors});
  await env.DB.prepare(`INSERT INTO messages (id,title,body) VALUES (?,?,?)`).bind(crypto.randomUUID(), title||'Update', body).run();
  return Response.json({ok:true}, {headers:cors});
}

async function adminOffersList(env, cors){
  const rows = await env.DB.prepare(`SELECT id,title,subtitle,payout_ngn,url_template,active FROM offers ORDER BY created_at DESC LIMIT 100`).all();
  return Response.json({offers: rows.results}, {headers:cors});
}
async function adminOfferAdd(req, env, cors){
  const {title, subtitle, payout_ngn, url_template} = await req.json().catch(()=>({}));
  if(!title || !url_template || !payout_ngn) return Response.json({error:'invalid'}, {status:400, headers:cors});
  await env.DB.prepare(`INSERT INTO offers (id,title,subtitle,payout_ngn,url_template) VALUES (?,?,?,?,?)`).bind(crypto.randomUUID(), title, subtitle||'', payout_ngn, url_template).run();
  return Response.json({ok:true}, {headers:cors});
}

/* ============ POSTBACK ============ */
async function postback(req, env){
  const url = new URL(req.url);
  const q = Object.fromEntries(url.searchParams);
  const ip = req.headers.get('CF-Connecting-IP')||'';
  const log = status => env.DB.prepare(`INSERT INTO postback_log (query,ip,status) VALUES (?,?,?)`).bind(url.search, ip, status).run();
  const {sub1, payout, txid, sig} = q;
  if(!sub1 || !payout || !txid || !sig){ await log('bad_params'); return new Response('bad', {status:400}); }
  const expected = await signStr(env.POSTBACK_SECRET, `${sub1}|${payout}|${txid}`);
  if(expected !== sig){ await log('bad_sig'); return new Response('forbidden', {status:403}); }
  const seen = await env.DB.prepare(`SELECT 1 FROM clicks WHERE txid=?`).bind(txid).first();
  if(seen){ await log('dup'); return new Response('ok'); }
  const c = await env.DB.prepare(`SELECT * FROM clicks WHERE sub_id=? AND status='pending'`).bind(sub1).first();
  if(!c){ await log('no_click'); return new Response('ok'); }
  const amount = Math.max(0, Math.min(parseInt(payout,10)||0, c.payout_ngn*2));
  await env.DB.batch([
    env.DB.prepare(`UPDATE clicks SET status='credited',txid=?,credited_at=datetime('now') WHERE sub_id=? AND status='pending'`).bind(txid, sub1),
    env.DB.prepare(`UPDATE users SET balance=balance+?,earned_total=earned_total+?,tasks_done=tasks_done+1 WHERE telegram_id=?`).bind(amount, amount, c.telegram_id),
    env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(c.telegram_id, amount, 'offer', sub1)
  ]);
  await checkReferralActivation(env, c.telegram_id);
  const fresh = await env.DB.prepare(`SELECT earned_total FROM users WHERE telegram_id=?`).bind(c.telegram_id).first();
  await networkCall(env, '/api/track-earn', { app_id: 'cryptonaira', user_telegram_id: c.telegram_id, new_earned_total: fresh?.earned_total || 0 });
  await log('credited');
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({chat_id: c.telegram_id, text: `Offer credited: +₦${amount}. Balance updated.`})
  }).catch(()=>{});
  return new Response('ok');
}
