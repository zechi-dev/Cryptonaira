/* ============ MASTER POSTBACK ROUTER ============ */
async function postback(req, env){
  const url = new URL(req.url);
  const ip = req.headers.get('CF-Connecting-IP')||'';
  const log = status => env.DB.prepare(`INSERT INTO postback_log (query,ip,status) VALUES (?,?,?)`).bind(url.search, ip, status).run();

  // ==========================================
  // 1. MONEYRAIN (JSON POST)
  // ==========================================
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const rawBody = await req.text();
    const signature = req.headers.get('X-MoneyRain-Signature');
    
    if (signature && env.MONEYRAIN_SECRET) {
      const expectedSig = 'sha256=' + await signStr(env.MONEYRAIN_SECRET, rawBody);
      if (expectedSig !== signature) {
        await log('moneyrain_bad_sig');
        return new Response('forbidden', {status:403});
      }
    }

    const data = JSON.parse(rawBody);
    const sub1 = data.external_uid; 
    const txid = String(data.view_id); 
    const usdAmount = parseFloat(data.reward_usdt); 

    if (!sub1 || !txid) { await log('moneyrain_bad_params'); return new Response('bad', {status:400}); }

    const seen = await env.DB.prepare(`SELECT 1 FROM clicks WHERE txid=?`).bind(txid).first();
    if (seen) { await log('moneyrain_dup'); return new Response('ok'); }

    const user = await env.DB.prepare(`SELECT telegram_id FROM users WHERE telegram_id=?`).bind(sub1).first();
    if (!user) { await log('moneyrain_no_user'); return new Response('ok'); }

    const amount = Math.round(usdAmount * 900); 

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(user.telegram_id, amount, 'offer_moneyrain', txid),
      env.DB.prepare(`UPDATE users SET balance=balance+?, earned_total=earned_total+?, tasks_done=tasks_done+1 WHERE telegram_id=?`).bind(amount, amount, user.telegram_id)
    ]);

    await log('moneyrain_credited');
    await checkReferralActivation(env, user.telegram_id);
    return new Response('ok');
  }

  // ==========================================
  // 2. URL PARAMETER NETWORKS (Adslab, BitOffers, Monetag)
  // ==========================================
  const q = Object.fromEntries(url.searchParams);
  
  let network = 'unknown';
  
  // Identify the network
  if (q.ymid || q.estimated_price || (q.telegram_id && q.value)) { 
    network = 'monetag'; 
  } else if (q.uid && q.signature) { 
    network = 'adslab'; 
  } else if (q.userid) { 
    network = 'bitoffers'; 
  }

  // SPECIAL MONETAG LOGIC: Ignore non-valued pings completely
  if (network === 'monetag') {
      if (q.value !== 'valued') {
          await log('monetag_non_valued_ignored');
          return new Response('ok'); // Tell Monetag we received it, but don't pay
      }
      if (!q.telegram_id || !q.estimated_price || !q.ymid) {
          await log('monetag_missing_data');
          return new Response('bad', {status:400});
      }
  }

  // Standard variable mapping
  const sub1 = q.sub1 || q.subId || q.userid || q.userId || q.uid || q.telegram_id;
  const payout = q.payout || q.amount || q.estimated_price || q.reward;
  const txid = q.txid || q.transId || q.transaction_id || q.ymid;

  if(!sub1 || !payout || !txid){ await log('bad_params'); return new Response('bad', {status:400}); }

  const seen = await env.DB.prepare(`SELECT 1 FROM clicks WHERE txid=?`).bind(txid).first();
  if(seen){ await log('dup'); return new Response('ok'); }

  let telegramId = null;
  if (/^\d+$/.test(sub1)) {
    telegramId = parseInt(sub1);
  } else {
    const c = await env.DB.prepare(`SELECT telegram_id FROM clicks WHERE sub_id=?`).bind(sub1).first();
    if(c) telegramId = c.telegram_id;
  }

  if(!telegramId){ await log('no_user'); return new Response('ok'); }

  // The magic math: Everything is converted at ₦900 per $1
  const usd = parseFloat(payout);
  const amount = Math.round(usd * 900);

  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET balance=balance+?, earned_total=earned_total+?, tasks_done=tasks_done+1 WHERE telegram_id=?`).bind(amount, amount, telegramId),
    env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(telegramId, amount, `offer_${network}`, txid),
    env.DB.prepare(`INSERT INTO clicks (sub_id, telegram_id, offer_id, payout_ngn, status, txid) VALUES (?,?,?,?,?,?) ON CONFLICT(sub_id) DO UPDATE SET status='credited', txid=excluded.txid`).bind(txid, telegramId, network, amount, 'credited', txid)
  ]);
  
  await checkReferralActivation(env, telegramId);
  await log(`credited_${network}`);

  return new Response('ok');
}
