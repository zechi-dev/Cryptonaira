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

// MD5 function for signatures
function md5(string) {
  function RotateLeft(lValue, iShiftBits) { return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits)); }
  function AddUnsigned(lX,lY) {
    var lX4,lY4,lX8,lY8,lResult;
    lX8 = (lX & 0x80000000); lY8 = (lY & 0x80000000); lX4 = (lX & 0x40000000); lY4 = (lY & 0x40000000);
    lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
    if (lX4 | lY4) { if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8); else return (lResult ^ 0x40000000 ^ lX8 ^ lY8); }
    else return (lResult ^ lX8 ^ lY8);
  }
  function F(x,y,z) { return (x & y) | ((~x) & z); }
  function G(x,y,z) { return (x & z) | (y & (~z)); }
  function H(x,y,z) { return (x ^ y ^ z); }
  function I(x,y,z) { return (y ^ (x | (~z))); }
  function FF(a,b,c,d,x,s,ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function GG(a,b,c,d,x,s,ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function HH(a,b,c,d,x,s,ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function II(a,b,c,d,x,s,ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function ConvertToWordArray(string) {
    var lWordCount, lMessageLength = string.length, lNumberOfWords_temp1 = lMessageLength + 8, lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16, lWordArray = Array(lNumberOfWords - 1), lBytePosition = 0, lByteCount = 0;
    while (lByteCount < lMessageLength) { lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8; lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition)); lByteCount++; }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8; lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3; lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function WordToHex(lValue) {
    var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) { lByte = (lValue >>> (lCount * 8)) & 255; WordToHexValue_temp = "0" + lByte.toString(16); WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2); }
    return WordToHexValue;
  }
  var x = Array(), k, AA, BB, CC, DD, a, b, c, d;
  var S11=7, S12=12, S13=17, S14=22, S21=5, S22=9 , S23=14, S24=20, S31=4, S32=11, S33=16, S34=23, S41=6, S42=10, S43=15, S44=21;
  string = string.replace(/\r\n/g,"\n");
  var utftext = "";
  for (var n = 0; n < string.length; n++) {
    var c = string.charCodeAt(n);
    if (c < 128) { utftext += String.fromCharCode(c); } else if((c > 127) && (c < 2048)) { utftext += String.fromCharCode((c >> 6) | 192); utftext += String.fromCharCode((c & 63) | 128); }
    else { utftext += String.fromCharCode((c >> 12) | 224); utftext += String.fromCharCode(((c >> 6) & 63) | 128); utftext += String.fromCharCode((c & 63) | 128); }
  }
  x = ConvertToWordArray(utftext); a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = FF(a, b, c, d, x[k+0], S11, 0xD76AA478); d = FF(d, a, b, c, x[k+1], S12, 0xE8C7B756); c = FF(c, d, a, b, x[k+2], S13, 0x242070DB); b = FF(b, c, d, a, x[k+3], S14, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k+4], S11, 0xF57C0FAF); d = FF(d, a, b, c, x[k+5], S12, 0x4787C62A); c = FF(c, d, a, b, x[k+6], S13, 0xA8304613); b = FF(b, c, d, a, x[k+7], S14, 0xFD469501);
    a = FF(a, b, c, d, x[k+8], S11, 0x698098D8); d = FF(d, a, b, c, x[k+9], S12, 0x8B44F7AF); c = FF(c, d, a, b, x[k+10], S13, 0xFFFF5BB1); b = FF(b, c, d, a, x[k+11], S14, 0x895CD7BE);
    a = FF(a, b, c, d, x[k+12], S11, 0x6B901122); d = FF(d, a, b, c, x[k+13], S12, 0xFD987193); c = FF(c, d, a, b, x[k+14], S13, 0xA679438E); b = FF(b, c, d, a, x[k+15], S14, 0x49B40821);
    a = GG(a, b, c, d, x[k+1], S21, 0xF61E2562); d = GG(d, a, b, c, x[k+6], S22, 0xC040B340); c = GG(c, d, a, b, x[k+11], S23, 0x265E5A51); b = GG(b, c, d, a, x[k+0], S24, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k+5], S21, 0xD62F105D); d = GG(d, a, b, c, x[k+10], S22, 0x2441453); c = GG(c, d, a, b, x[k+15], S23, 0xD8A1E681); b = GG(b, c, d, a, x[k+4], S24, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k+9], S21, 0x21E1CDE6); d = GG(d, a, b, c, x[k+14], S22, 0xC33707D6); c = GG(c, d, a, b, x[k+3], S23, 0xF4D50D87); b = GG(b, c, d, a, x[k+8], S24, 0x455A14ED);
    a = GG(a, b, c, d, x[k+13], S21, 0xA9E3E905); d = GG(d, a, b, c, x[k+2], S22, 0xFCEFA3F8); c = GG(c, d, a, b, x[k+7], S23, 0x676F02D9); b = GG(b, c, d, a, x[k+12], S24, 0x8D2A4C8A);
    a = HH(a, b, c, d, x[k+5], S31, 0xFFFA3942); d = HH(d, a, b, c, x[k+8], S32, 0x8771F681); c = HH(c, d, a, b, x[k+11], S33, 0x6D9D6122); b = HH(b, c, d, a, x[k+14], S34, 0xFDE5380C);
    a = HH(a, b, c, d, x[k+1], S31, 0xA4BEEA44); d = HH(d, a, b, c, x[k+4], S32, 0x4BDECFA9); c = HH(c, d, a, b, x[k+7], S33, 0xF6BB4B60); b = HH(b, c, d, a, x[k+10], S34, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k+13], S31, 0x289B7EC6); d = HH(d, a, b, c, x[k+0], S32, 0xEAA127FA); c = HH(c, d, a, b, x[k+3], S33, 0xD4EF3085); b = HH(b, c, d, a, x[k+6], S34, 0x4881D05);
    a = HH(a, b, c, d, x[k+9], S31, 0xD9D4D039); d = HH(d, a, b, c, x[k+12], S32, 0xE6DB99E5); c = HH(c, d, a, b, x[k+15], S33, 0x1FA27CF8); b = HH(b, c, d, a, x[k+2], S34, 0xC4AC5665);
    a = II(a, b, c, d, x[k+0], S41, 0xF4292244); d = II(d, a, b, c, x[k+7], S42, 0x432AFF97); c = II(c, d, a, b, x[k+14], S43, 0xAB9423A7); b = II(b, c, d, a, x[k+5], S44, 0xFC93A039);
    a = II(a, b, c, d, x[k+12], S41, 0x655B59C3); d = II(d, a, b, c, x[k+3], S42, 0x8F0CCC92); c = II(c, d, a, b, x[k+10], S43, 0xFFEFF47D); b = II(b, c, d, a, x[k+1], S44, 0x85845DD1);
    a = II(a, b, c, d, x[k+8], S41, 0x6FA87E4F); d = II(d, a, b, c, x[k+15], S42, 0xFE2CE6E0); c = II(c, d, a, b, x[k+6], S43, 0xA3014314); b = II(b, c, d, a, x[k+13], S44, 0x4E0811A1);
    a = II(a, b, c, d, x[k+4], S41, 0xF7537E82); d = II(d, a, b, c, x[k+11], S42, 0xBD3AF235); c = II(c, d, a, b, x[k+2], S43, 0x2AD7D2BB); b = II(b, c, d, a, x[k+9], S44, 0xEB86D391);
    a = AddUnsigned(a, AA); b = AddUnsigned(b, BB); c = AddUnsigned(c, CC); d = AddUnsigned(d, DD);
  }
  var temp = WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d);
  return temp.toLowerCase();
}

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

async function networkCall(env, path, body){
  if(!env.NETWORK_URL || !env.NETWORK_SECRET) return;
  try { await fetch(env.NETWORK_URL + path, { method:'POST', headers:{'Content-Type':'application/json','X-Network-Secret': env.NETWORK_SECRET}, body: JSON.stringify(body) }); } catch(e){ }
}

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

async function settleCycles(env, userId){
  const past = await env.DB.prepare(`SELECT DISTINCT cycle_date FROM payouts WHERE referrer_id=? AND cycle_date IS NOT NULL AND cycle_date < ? AND status='paid'`).bind(userId, todayUtc()).all();
  for(const row of past.results){
    const settled = await env.DB.prepare(`SELECT 1 FROM cycle_settlements WHERE beneficiary_id=? AND cycle_date=?`).bind(userId, row.cycle_date).first();
    if(settled) continue;
    const activated = await env.DB.prepare(`SELECT COUNT(*) c FROM referrals WHERE referrer_id=? AND activated=1 AND expires_at > datetime('now')`).bind(userId).first();
    if((activated.c || 0) < 100){ await env.DB.prepare(`INSERT INTO cycle_settlements (beneficiary_id,cycle_date,referral_count,amount_ngn) VALUES (?,?,?,?)`).bind(userId, row.cycle_date, 0, 0).run(); continue; }
    const count = await env.DB.prepare(`SELECT COUNT(*) c FROM payouts WHERE referrer_id=? AND cycle_date=? AND status='paid'`).bind(userId, row.cycle_date).first();
    const cnt = count.c || 0;
    if(cnt >= 100){
      const amt = cnt * 5;
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO cycle_settlements (beneficiary_id,cycle_date,referral_count,amount_ngn) VALUES (?,?,?,?)`).bind(userId, row.cycle_date, cnt, amt),
        env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(userId, amt, 'cycle_bonus', row.cycle_date),
        env.DB.prepare(`UPDATE users SET balance=balance+?, earned_total=earned_total+? WHERE telegram_id=?`).bind(amt, amt, userId)
      ]);
    } else { await env.DB.prepare(`INSERT INTO cycle_settlements (beneficiary_id,cycle_date,referral_count,amount_ngn) VALUES (?,?,?,?)`).bind(userId, row.cycle_date, cnt, 0).run(); }
  }
}

export default {
  async fetch(req, env){
    const url = new URL(req.url);
    const cors = { 'Access-Control-Allow-Origin': env.APP_ORIGIN || '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Admin-Token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if(req.method === 'OPTIONS') return new Response(null, {headers:cors});
    try {
      if(url.pathname === '/postback') return await postback(req, env);
      if(url.pathname === '/admin/login' && req.method === 'POST') return await adminLogin(req, env, cors);
      if(url.pathname === '/api/sync' && req.method === 'POST') return await userSync(req, env, cors);
      if(url.pathname === '/api/me') return await userMe(req, env, cors);
      if(url.pathname === '/api/checkin' && req.method === 'POST') return await userCheckin(req, env, cors);
      if(url.pathname === '/api/wallet' && req.method === 'POST') return await userWallet(req, env, cors);
      if(url.pathname === '/api/withdraw' && req.method === 'POST') return await userWithdraw(req, env, cors);
      if(url.pathname === '/api/messages') return await userMessages(req, env, cors);
      if(url.pathname === '/api/messages/read' && req.method === 'POST') return await userMessagesRead(req, env, cors);
      if(url.pathname === '/api/cryptolink-iframe' && req.method === 'POST') return await getCryptoLinkIframe(req, env, cors);

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

      return new Response('not found', {status:404, headers:cors});
    } catch(e){ return Response.json({error:'server', detail:String(e)}, {status:500, headers:cors}); }
  }
};

async function getCryptoLinkIframe(req, env, cors){
    const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
    try {
        const res = await fetch('https://pub.cryptolinkforearn.com/api/publisher/embed-tokens', {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer ' + env.CRYPTOLINK_API_KEY, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                site_key: 'site_f7392231dfc7fc58f92845736d22102808e9b817', 
                sub_id: String(v.user.id),
                origin: 'https://cryptonaira.pages.dev',
                theme: 'dark'
            })
        });
        const data = await res.json();
        return Response.json({url: data.iframe_url}, {headers:cors});
    } catch(e) { return Response.json({error:'fetch_failed'}, {status:500, headers:cors}); }
}

async function userSync(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const uid = v.user.id;
  await env.DB.prepare(`INSERT INTO users (telegram_id,username,first_name) VALUES (?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name`).bind(uid, v.user.username||null, v.user.first_name||null).run();
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
    } else { await networkCall(env, '/api/track-signup', { app_id: 'cryptonaira', affiliate_code: sp, user_telegram_id: uid }); }
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
  return Response.json({ uid, username: v.user.username||v.user.first_name, balance: u2?.balance ?? 0, earned_total: u2?.earned_total ?? 0, tasks_done: u2?.tasks_done ?? 0, streak: u2?.streak ?? 0, last_checkin: u2?.last_checkin ?? null, wallet: w || null, referrals: rc, history: hist.results, unread: unread?.c || 0 }, {headers:cors});
}

async function userCheckin(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const uid = v.user.id, day = todayUtc();
  const u = await env.DB.prepare(`SELECT streak,last_checkin FROM users WHERE telegram_id=?`).bind(uid).first();
  if(u?.last_checkin === day) return Response.json({error:'already'}, {status:409, headers:cors});
  let streak = (u?.last_checkin === yestUtc()) ? (u.streak||0) : 0; streak = streak >= 7 ? 1 : streak + 1;
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

async function userWallet(req, env, cors){
  const v = await authUser(req, env); if(!v) return Response.json({error:'auth'}, {status:401, headers:cors});
  const {bankName, acctNum, acctName} = await req.json().catch(()=>({}));
  if(!bankName || !/^\d{10}$/.test(acctNum||'') || !acctName) return Response.json({error:'invalid'}, {status:400, headers:cors});
  await env.DB.prepare(`INSERT INTO wallets (telegram_id,bank_name,acct_num,acct_name,updated_at) VALUES (?,?,?,?,datetime('now')) ON CONFLICT(telegram_id) DO UPDATE SET bank_name=excluded.bank_name, acct_num=excluded.acct_num, acct_name=excluded.acct_name, updated_at=datetime('now')`).bind(v.user.id, bankName, acctNum, acctName).run();
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
  const amount = u.balance; const id = crypto.randomUUID(); const cycleDate = nextCycleDate(new Date());
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
  for(const m of msgs.results){ await env.DB.prepare(`INSERT OR IGNORE INTO message_reads (message_id,reader_id) VALUES (?,?)`).bind(m.id, v.user.id).run(); }
  return Response.json({ok:true}, {headers:cors});
}

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
  const totalCredited = credited?.s || 0; const totalPaid = paid?.s || 0; const pendingPaid = pending?.s || 0; const balanceHeld = balances?.s || 0;
  return Response.json({ totalUsers: users?.c || 0, totalCredited, totalPaid, totalPaidCount: paid?.c || 0, pendingPayouts: pendingPaid, pendingCount: pending?.c || 0, currentBalance: balanceHeld, platformNet: totalCredited - totalPaid - pendingPaid - balanceHeld }, {headers:cors});
}

async function adminUsers(req, env, url, cors){
  const page = Math.max(1, parseInt(url.searchParams.get('page')||'1',10)); const q = (url.searchParams.get('q')||'').trim(); const limit = 100, offset = (page-1)*limit;
  let where = '', params = [];
  if(q){ where = `WHERE (username LIKE ? OR CAST(telegram_id AS TEXT) LIKE ?)`; params = ['%'+q+'%', '%'+q+'%']; }
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
  const rows = await env.DB.prepare(`SELECT p.id,p.owner_id as telegram_id,p.amount_ngn,p.status,p.created_at, u.username, u.first_name, w.bank_name, w.acct_num, w.acct_name FROM payouts p LEFT JOIN users u ON u.telegram_id=p.owner_id LEFT JOIN wallets w ON w.telegram_id=p.owner_id ORDER BY p.created_at DESC LIMIT 200`).all();
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

/* ============ MASTER POSTBACK ROUTER ============ */
async function postback(req, env){
  const url = new URL(req.url);
  const ip = req.headers.get('CF-Connecting-IP')||'';
  const log = status => env.DB.prepare(`INSERT INTO postback_log (query,ip,status) VALUES (?,?,?)`).bind(url.search, ip, status).run();

  // 1. MONEYRAIN (JSON POST)
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const rawBody = await req.text();
    const signature = req.headers.get('X-MoneyRain-Signature');
    if (signature && env.MONEYRAIN_SECRET) {
      const expectedSig = 'sha256=' + await signStr(env.MONEYRAIN_SECRET, rawBody);
      if (expectedSig !== signature) { await log('moneyrain_bad_sig'); return new Response('forbidden', {status:403}); }
    }
    const data = JSON.parse(rawBody);
    const sub1 = data.external_uid; const txid = String(data.view_id); const usdAmount = parseFloat(data.reward_usdt); 
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
    await log('moneyrain_credited'); await checkReferralActivation(env, user.telegram_id);
    return new Response('ok');
  }

  // 2. URL/PARAMETER NETWORKS
  let q = Object.fromEntries(url.searchParams);
  if (req.method === 'POST') {
      const formData = await req.formData().catch(()=>null);
      if (formData) { for (const [key, value] of formData.entries()) { q[key] = value; } }
      else {
          const text = await req.text().catch(()=>"");
          try { const json = JSON.parse(text); q = { ...q, ...json }; } catch(e) { }
      }
  }

  let network = 'unknown';
  if (q.uid && q.signature) { network = 'adslab'; } 
  else if (q.subId && q.transId && q.reward_pb !== undefined) { network = 'cryptolink'; }
  else if (q.subId && q.signature && q.transId && q.reward !== undefined) { network = 'offerwallapi'; }

  // CRYPTOLINK SPECIFIC LOGIC
  if (network === 'cryptolink') {
      const status = parseInt(q.status);
      if (status === 0) { await log('cryptolink_pending'); return new Response('ok'); } // Pending, do nothing
      
      const sub1 = q.subId;
      const txid = q.transId;
      const payout = parseFloat(q.reward_pb);
      const amount = status === 1 ? payout : -payout; // status 1 = credit, status 2 = chargeback

      // 1. Verify Signature
      if (env.CRYPTOLINK_SECRET) {
          const str = `${sub1}${txid}${q.reward_pb}${env.CRYPTOLINK_SECRET}`;
          const expected = md5(str);
          if (q.signature !== expected) { await log('cryptolink_bad_sig'); return new Response('forbidden', {status:403}); }
      }

      // 2. Deduplicate (Only for credits, status 1)
      if (status === 1) {
          const seen = await env.DB.prepare(`SELECT 1 FROM clicks WHERE txid=?`).bind(txid).first();
          if (seen) { await log('cryptolink_dup'); return new Response('ok'); }
      }

      // 3. Check User
      let telegramId = null;
      if (/^\d+$/.test(sub1)) { telegramId = parseInt(sub1); }
      if(!telegramId){ await log('cryptolink_no_user'); return new Response('ok'); }

      // 4. Credit / Chargeback
      await env.DB.batch([
        env.DB.prepare(`UPDATE users SET balance=balance+?, earned_total=earned_total+? WHERE telegram_id=?`).bind(amount, status === 1 ? amount : 0, telegramId),
        env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(telegramId, amount, `offer_cryptolink_${status}`, txid),
        status === 1 ? env.DB.prepare(`INSERT INTO clicks (sub_id, telegram_id, offer_id, payout_ngn, status, txid) VALUES (?,?,?,?,?,?)`).bind(txid, telegramId, 'cryptolink', amount, 'credited', txid) : env.DB.prepare(`SELECT 1`)
      ]);
      
      await checkReferralActivation(env, telegramId);
      await log(`cryptolink_credited_status_${status}`);
      return new Response('ok');
  }

  // STANDARD LOGIC FOR OTHER NETWORKS
  const sub1 = q.sub1 || q.subId || q.userid || q.userId || q.uid || q.telegram_id;
  const payout = q.payout || q.amount || q.estimated_price || q.reward;
  const txid = q.txid || q.transId || q.transaction_id || q.ymid;

  if(!sub1 || !payout || !txid){ await log('bad_params'); return new Response('bad', {status:400}); }

  const seen = await env.DB.prepare(`SELECT 1 FROM clicks WHERE txid=?`).bind(txid).first();
  if(seen){ await log('dup'); return new Response('ok'); }

  let telegramId = null;
  if (/^\d+$/.test(sub1)) { telegramId = parseInt(sub1); } 
  else { const c = await env.DB.prepare(`SELECT telegram_id FROM clicks WHERE sub_id=?`).bind(sub1).first(); if(c) telegramId = c.telegram_id; }
  if(!telegramId){ await log('no_user'); return new Response('ok'); }

  if (network === 'offerwallapi' && env.OFFERWALLAPI_SECRET) {
      const str = `${sub1}${txid}${payout}${env.OFFERWALLAPI_SECRET}`;
      const expected = md5(str);
      if (q.signature !== expected) { await log('offerwallapi_bad_sig'); return new Response('forbidden', {status:403}); }
  }

  const amount = Math.round(parseFloat(payout) * 900);

  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET balance=balance+?, earned_total=earned_total+?, tasks_done=tasks_done+1 WHERE telegram_id=?`).bind(amount, amount, telegramId),
    env.DB.prepare(`INSERT INTO ledger (owner_id,delta,reason,ref) VALUES (?,?,?,?)`).bind(telegramId, amount, `offer_${network}`, txid),
    env.DB.prepare(`INSERT INTO clicks (sub_id, telegram_id, offer_id, payout_ngn, status, txid) VALUES (?,?,?,?,?,?) ON CONFLICT(sub_id) DO UPDATE SET status='credited', txid=excluded.txid`).bind(txid, telegramId, network, amount, 'credited', txid)
  ]);
  
  await checkReferralActivation(env, telegramId);
  await log(`credited_${network}`);
  return new Response('ok');
}
