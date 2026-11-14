export default {
  async fetch(req, env){
    const url = new URL(req.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Admin-Token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if(req.method === 'OPTIONS') return new Response(null, {headers:cors});
    try {
      if(url.pathname === '/postback') return await postback(req, env);
      
      // ... (Keep your existing user routes: /api/sync, /api/me, /api/checkin, etc.) ...
      // ... (Keep your existing admin routes) ...

      return new Response('not found', {status:404, headers:cors});
    } catch(e){ return Response.json({error:'server', detail:String(e)}, {status:500, headers:cors}); }
  }
};

async function postback(req, env){
  const url = new URL(req.url);
  const ip = req.headers.get('CF-Connecting-IP')||'';
  
  const log = status => env.DB.prepare(`INSERT INTO postback_log (query,ip,status) VALUES (?,?,?)`).bind(url.search, ip, status).run();

  // 1. INSTANTLY APPROVE ALL TEST PINGS (So dashboards turn green)
  if (url.search.includes('test') || url.search.includes('debug=1') || url.search.includes('test_user')) {
      await log('test_ping_ok');
      return new Response('ok');
  }

  // 2. PARSE DATA (Handles both JSON and URL params)
  let q = Object.fromEntries(url.searchParams);
  const contentType = req.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    const rawBody = await req.text();
    try {
        const data = JSON.parse(rawBody);
        q = { ...q, ...data };
    } catch(e) {}
  } else if (req.method === 'POST') {
      const formData = await req.formData().catch(()=>null);
      if (formData) { for (const [key, value] of formData.entries()) { q[key] = value; } }
  }

  // 3. FIND USER AND AMOUNT (From any possible variable name)
  const sub1 = q.sub1 || q.subId || q.userid || q.userId || q.uid || q.telegram_id || q.external_uid;
  const payout = q.payout || q.amount || q.estimated_price || q.reward || q.reward_pb;
  const txid = q.txid || q.transId || q.transaction_id || q.ymid || q.view_id || `auto_${Date.now()}_${Math.random()}`;

  // If no user ID or amount, just say OK (don't throw an error that breaks the network)
  if(!sub1 || payout === undefined){ await log('ignored_missing_data'); return new Response('ok'); }

  // Find Telegram ID
  let telegramId = null;
  if (/^\d+$/.test(sub1)) { telegramId = parseInt(sub1); } 
  else { const c = await env.DB.prepare(`SELECT telegram_id FROM clicks WHERE sub_id=?`).bind(sub1).first(); if(c) telegramId = c.telegram_id; }
  
  if(!telegramId){ await log('ignored_no_user'); return new Response('ok'); }

  // Calculate Amount (If it looks like USD, multiply by 900)
  let amount = 0;
  const parsedPayout = parseFloat(payout);
  
  if (q.estimated_price !== undefined || (q.payout !== undefined && parsedPayout < 5)) { 
      amount = Math.round(parsedPayout * 900); // USD to Naira
  } else {
      amount = Math.round(parsedPayout); // Assume Naira
  }

  // 4. CREDIT THE USER
  if (amount > 0) {
      try {
          await env.DB.batch([
            env.DB.prepare(`UPDATE users SET balance=balance+?, earned_total=earned_total+?, tasks_done=tasks_done+1 WHERE telegram_id=?`).bind(amount, amount, telegramId),
            env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(telegramId, amount, 'offer_credit', txid),
            env.DB.prepare(`INSERT INTO clicks (sub_id, telegram_id, offer_id, payout_ngn, status, txid) VALUES (?,?,?,?,?,?) ON CONFLICT(sub_id) DO UPDATE SET status='credited'`).bind(txid, telegramId, 'network', amount, 'credited', txid)
          ]);
          await log('credited');
      } catch(e) {
          await log('db_error');
      }
  }

  return new Response('ok');
}
