'use strict';
// Comptel Sumqayıt — server (əlavə proqram quraşdırmaq lazım deyil, yalnız Node.js 18+)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = __dirname, PUB = path.join(ROOT, 'public'), DATA = path.join(ROOT, 'data'), DBF = path.join(DATA, 'db.json');
const LOCKF = path.join(DATA, 'admin.lock');
const TG_SALES_F = path.join(DATA, 'telegram_sales.token');
const TG_ADMIN_F = path.join(DATA, 'telegram_admin.token');

// .env oxu (".env" yoxdursa "_env" faylına da baxır). Artıq təyin olunmuş mühit dəyişənləri üstünə yazılmır.
for (const fn of ['.env', '_env']) {
  let txt; try { txt = fs.readFileSync(path.join(ROOT, fn), 'utf8'); } catch { continue; }
  for (const l of txt.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  break;
}
const PORT = +process.env.PORT || 3000, ADMIN = process.env.ADMIN_PASSWORD || '';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const OWNER_PHONE = '+994 51 626 26 16', OWNER_WA = '994516262616';

const FIELDS = {
  products: { name: 's', cat: 's', price: 'n', old: 'n', img: 's', short: 's', desc: 'l', specs: 'l' },
  gifts: { name: 's', points: 'n', desc: 'l', img: 's' }
};
const SETTINGS = [
  'name', 'heroTag', 'heroTitle', 'heroText', 'heroPrice', 'perPoint',
  'whatsapp', 'phone', 'address', 'hours',
  'newsTitle', 'news',
  'perk1Title', 'perk1Text', 'perk2Title', 'perk2Text', 'perk3Title', 'perk3Text',
  'productsTitle', 'giftsTitle', 'giftsText',
  'sellTitle', 'sellText',
  'contactTitle', 'contactText', 'waText', 'footer'
];
const LONG_SETTINGS = new Set(['news', 'heroText', 'sellText', 'giftsText', 'contactText']);
const STATUS = { orders: ['Yeni', 'Təsdiqləndi', 'Yoldadır', 'Tamamlandı', 'Ləğv edildi'], sells: ['Yeni', 'Əlaqə saxlanıldı', 'Alındı', 'Rədd edildi'] };
// Instagram qəsdən yoxdur
const SOCIAL = {
  google: 'Google', facebook: 'Facebook', apple: 'Apple', telegram: 'Telegram',
  twitter: 'X', tiktok: 'TikTok', linkedin: 'LinkedIn', vk: 'VK',
  microsoft: 'Microsoft', yandex: 'Yandex'
};
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const mk = (id, name, cat, price, old, short, desc, specs) => ({ id, name, cat, price, old, img: '', short, desc, specs });
const defaultSettings = () => ({
  name: 'Comptel Sumqayıt',
  heroTag: 'Günün təklifi',
  heroTitle: 'Smartfon 128 GB',
  heroText: 'Bu gün mağazamızda xüsusi qiymət. Saytdan sifariş ver, bütün ölkəyə çatdırırıq.',
  heroPrice: '649',
  perPoint: 10,
  whatsapp: OWNER_WA,
  phone: OWNER_PHONE,
  address: 'Sumqayıt',
  hours: '10:00 – 20:00',
  newsTitle: 'Yeniliklər',
  news: '',
  perk1Title: 'Bütün ölkəyə çatdırılma',
  perk1Text: 'Hər bölgəyə göndəririk',
  perk2Title: 'Point topla, hədiyyə qazan',
  perk2Text: '',
  perk3Title: 'Köhnə telefonunu sat',
  perk3Text: 'Aşağıdakı formu doldur, zəng edək',
  productsTitle: 'Məhsullar',
  giftsTitle: 'Hədiyyələr',
  giftsText: '',
  sellTitle: 'Telefonunu və ya digər malını sat',
  sellText: 'İstifadə etmədiyin telefon, aksesuar və ya texnikanı bizə sat. Məlumatı yaz, qiymət üçün sənə zəng edək.',
  contactTitle: 'Bizə yaz və ya gəl',
  contactText: 'Məhsulun mövcudluğunu və qiymətini soruşmaq üçün zəng et, ya da WhatsApp-da yaz.',
  waText: 'Salam, Comptel Sumqayıt. Məhsul haqqında soruşmaq istəyirəm.',
  footer: 'Bütün hüquqlar qorunur.'
});
const seed = () => ({
  settings: defaultSettings(),
  products: [
    mk('p1', 'Smartfon 128 GB', 'Telefonlar', 649, 699, '6.1″ ekran, 5G', 'Gündəlik istifadə üçün sürətli smartfon. Parlaq ekran, uzun işləyən batareya və keyfiyyətli kamera.', 'Yaddaş: 128 GB\nEkran: 6.1″ OLED\nBatareya: 4500 mAh\nƏlaqə: 5G'),
    mk('p2', 'Smartfon Pro 256 GB', 'Telefonlar', 1299, 0, 'Üç kameralı, 5G', 'Güclü prosessor və üç kameralı sistem. Oyun və video üçün ideal.', 'Yaddaş: 256 GB\nEkran: 6.7″ OLED 120 Hz\nBatareya: 5000 mAh'),
    mk('p3', 'Büdcə smartfon 64 GB', 'Telefonlar', 289, 0, 'Gündəlik istifadə üçün', 'Zəng, mesaj, sosial şəbəkələr və kamera üçün sərfəli seçim.', 'Yaddaş: 64 GB\nEkran: 6.5″\nBatareya: 5000 mAh'),
    mk('p4', 'Qoruyucu şüşə', 'Aksesuarlar', 12, 0, '9H sərtlik, bütün modellər', 'Ekranı cızıqdan və zərbədən qoruyur. Modelinizi bizə yazın, uyğununu seçək.', 'Sərtlik: 9H\nQalınlıq: 0.3 mm'),
    mk('p5', 'Silikon qabıq', 'Aksesuarlar', 15, 0, 'Zərbəyə davamlı', 'Telefonu düşmədən və cızıqdan qoruyur. Müxtəlif rənglər var.', 'Material: silikon\nRənglər: qara, şəffaf, göy'),
    mk('p6', 'Sürətli şarj cihazı 30W', 'Aksesuarlar', 29, 0, 'Kabel daxildir', 'Telefonu qısa vaxtda doldurur. Type-C kabel qutuya daxildir.', 'Güc: 30W\nGirişi: Type-C'),
    mk('p7', 'Simsiz qulaqlıq', 'Qulaqlıqlar', 79, 0, 'Bluetooth 5.3, 24 saat', 'Açıq şəkildə danışıq və musiqi. Qutu ilə birlikdə 24 saat işləyir.', 'Bluetooth: 5.3\nİş vaxtı: 24 saat (qutu ilə)'),
    mk('p8', 'Powerbank 20 000 mAh', 'Digər', 55, 65, 'Eyni anda 2 cihaz', 'Səfərdə telefonu bir neçə dəfə doldurur.', 'Tutum: 20 000 mAh\nÇıxış: 2 port')
  ],
  gifts: [
    { id: 'g1', name: 'Qoruyucu şüşə', points: 30, desc: 'Telefonunuz üçün 9H qoruyucu şüşə (quraşdırma ilə).', img: '' },
    { id: 'g2', name: 'Silikon qabıq', points: 50, desc: 'Seçdiyiniz rəngdə silikon qabıq.', img: '' },
    { id: 'g3', name: 'Naqilli qulaqlıq', points: 80, desc: 'Type-C naqilli qulaqlıq.', img: '' },
    { id: 'g4', name: 'Şarj cihazı 30W', points: 150, desc: 'Sürətli 30W şarj cihazı, kabel ilə.', img: '' }
  ],
  users: [], orders: [], sells: [], sessions: {}, meta: {}
});

// ---------- Verilənlər bazası ----------
let db;
const save = () => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(DBF + '.tmp', JSON.stringify(db, null, 1)); fs.renameSync(DBF + '.tmp', DBF); };
try {
  db = JSON.parse(fs.readFileSync(DBF, 'utf8'));
} catch (e) {
  if (e.code === 'ENOENT') { db = seed(); save(); }
  else {
    // Fayl var, amma oxunmur: üstünə yazıb məlumatı İTİRMİRİK
    const bak = DBF + '.corrupt-' + Date.now();
    try { fs.copyFileSync(DBF, bak); } catch {}
    console.error('XƏTA: data/db.json zədəlidir (' + e.message + '). Nüsxə: ' + bak + '\nDüzəldin və ya silin, sonra yenidən işə salın.');
    process.exit(1);
  }
}
for (const k of ['users', 'orders', 'sells', 'products', 'gifts']) if (!Array.isArray(db[k])) db[k] = [];
if (!db.sessions || typeof db.sessions !== 'object') db.sessions = {};
if (!db.meta || typeof db.meta !== 'object') db.meta = {};
db.settings = { ...defaultSettings(), ...(db.settings || {}) };
// Bir dəfəlik: nömrəni düzgün nömrə ilə əvəz et (sonra admin paneldən dəyişmək olar)
if (!db.meta.phoneFixed) { db.settings.phone = OWNER_PHONE; db.settings.whatsapp = OWNER_WA; db.meta.phoneFixed = true; }
if (!db.meta.contactFixed) { db.settings.address = 'Sumqayıt'; db.settings.hours = '10:00 – 20:00'; db.meta.contactFixed = true; }
db.settings.whatsapp = String(db.settings.whatsapp || '').replace(/\D/g, '') || OWNER_WA;
if (!db.settings.phone) db.settings.phone = OWNER_PHONE;
const SESS_TTL = 30 * 864e5, ADMIN_TTL = 12 * 36e5;
for (const [k, v] of Object.entries(db.sessions)) {          // köhnə sessiyaları yeni formata çevir / vaxtı keçmişləri təmizlə
  if (typeof v === 'string') db.sessions[k] = { uid: v, exp: Date.now() + SESS_TTL };
  else if (!v || !(v.exp > Date.now())) delete db.sessions[k];
}
save();

// Gündəlik nüsxə (son 14 gün) — data/backup/
function backup() {
  try {
    const d = path.join(DATA, 'backup'); fs.mkdirSync(d, { recursive: true });
    const f = path.join(d, 'db-' + new Date().toISOString().slice(0, 10) + '.json');
    if (!fs.existsSync(f)) fs.copyFileSync(DBF, f);
    const all = fs.readdirSync(d).filter(x => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort();
    for (const x of all.slice(0, -14)) fs.unlinkSync(path.join(d, x));
  } catch (e) { console.log('Backup xətası:', e.message); }
}
backup(); setInterval(backup, 6 * 36e5).unref();

// ---------- Köməkçilər ----------
const admins = new Map();                       // token -> bitmə vaxtı
const now = () => new Date().toISOString();
const clean = (s, n = 300) => String(s ?? '').trim().slice(0, n);
const eq = (a, b) => { const h = x => crypto.createHash('sha256').update(String(x)).digest(); return crypto.timingSafeEqual(h(a), h(b)); };
const hash = (p, s = crypto.randomBytes(8).toString('hex')) => s + ':' + crypto.scryptSync(p, s, 32).toString('hex');
const check = (p, h) => { const [s, x] = String(h || '').split(':'); if (!s || !x) return false; const a = Buffer.from(hash(p, s).split(':')[1], 'hex'), b = Buffer.from(x, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const HEADERS = { 'x-content-type-options': 'nosniff', 'x-frame-options': 'SAMEORIGIN', 'referrer-policy': 'same-origin' };
const send = (r, c, o) => { r.writeHead(c, { ...HEADERS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); r.end(JSON.stringify(o)); };
const clientIp = req => (TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || '';

// Telefon: yalnız rəqəm (+, boşluq, tire, mötərizə formatlama kimi icazəlidir); hərf olmaz.
// 0516262616 / 516262616 / +994 51 626 26 16 -> 994516262616
const normDigits = raw => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10 && d[0] === '0') d = '994' + d.slice(1);
  else if (d.length === 9) d = '994' + d;
  return d;
};
function readPhone(raw) {
  const s = clean(raw, 25);
  if (!s) return { err: 'Telefon nömrəsini yazın.' };
  if (/[^\d+\s()\-]/.test(s)) return { err: 'Telefon nömrəsində yalnız rəqəm olmalıdır (hərf və simvol olmaz).' };
  const num = normDigits(s);
  if (!/^\d{9,15}$/.test(num)) return { err: 'Telefon nömrəsi düzgün deyil.' };
  return { num };
}

// Sadə sürət məhdudiyyəti
const hits = new Map();
function limited(key, max, ms) {
  const t = Date.now(), a = (hits.get(key) || []).filter(x => t - x < ms); a.push(t); hits.set(key, a); return a.length > max;
}
setInterval(() => { const t = Date.now(); for (const [k, a] of hits) if (!a.length || t - a[a.length - 1] > 36e5) hits.delete(k); }, 6e5).unref();

// ---------- Telegram ----------
function readTokenFile(f) {
  try {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    return { token: lines[0] || '', chat: lines[1] || '' };
  } catch { return { token: '', chat: '' }; }
}
function writeTokenFile(f, token, chat) {
  const head = f === TG_SALES_F
    ? '# Telegram bot — sifariş, hədiyyə, satış müraciəti və sayt yenilikləri\n# 1-ci sətir: bot token\n# 2-ci sətir: chat_id\n'
    : '# Telegram bot — admin səhv giriş və blok bildirişləri\n# 1-ci sətir: bot token\n# 2-ci sətir: chat_id\n';
  const one = (s, n) => String(s ?? '').replace(/\s/g, '').slice(0, n);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(f, head + one(token, 200) + '\n' + one(chat, 40) + '\n');
}
function tgConfig(kind) {
  if (kind === 'sales') {
    const f = readTokenFile(TG_SALES_F);
    return { token: f.token || process.env.TELEGRAM_SALES_TOKEN || process.env.TELEGRAM_TOKEN || '', chat: f.chat || process.env.TELEGRAM_SALES_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '' };
  }
  const f = readTokenFile(TG_ADMIN_F);
  return { token: f.token || process.env.TELEGRAM_ADMIN_TOKEN || process.env.TELEGRAM_TOKEN || '', chat: f.chat || process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '' };
}
async function notifyTelegram(kind, text) {
  console.log('[BİLDİRİM ' + kind + ']', text);
  const { token, chat } = tgConfig(kind);
  if (!token || !chat) { console.log('Telegram (' + kind + ') qurulmayıb: token və ya chat_id yoxdur.'); return { ok: false, error: 'Token və ya chat_id yazılmayıb' }; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: String(text).slice(0, 4000) }),
      signal: AbortSignal.timeout(10000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { console.log('Telegram (' + kind + ') xətası:', j.description || r.status); return { ok: false, error: j.description || ('HTTP ' + r.status) }; }
    return { ok: true };
  } catch (e) { console.log('Telegram (' + kind + ') xətası:', e.message); return { ok: false, error: e.message }; }
}

// ---------- Admin bloku ----------
let lockedMem = false, lastBlockedNote = 0;
const isLocked = () => lockedMem || fs.existsSync(LOCKF);
function lockAdmin(ip) {
  admins.clear();                                   // açıq admin sessiyaları da bağlanır
  try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(LOCKF, 'blocked at ' + now() + '\nip: ' + ip + '\n'); }
  catch (e) { lockedMem = true; console.error('admin.lock yazıla bilmədi, yaddaşda bloklandı:', e.message); }
}

// ---------- API ----------
const imgOk = s => !s || (!s.includes('..') && (/^\/img\/[^\s"'<>\\]+$/.test(s) || /^https?:\/\/[^\s"'<>\\]+$/.test(s)));

async function api(req, res, p, b) {
  const R = req.method + ' ' + p, tok = String(req.headers['x-token'] || ''), S = db.settings, ip = clientIp(req);
  const sess = has(db.sessions, tok) ? db.sessions[tok] : null;
  const user = sess && sess.exp > Date.now() ? db.users.find(x => x.id === sess.uid) : null;
  const bad = (m, c = 400) => send(res, c, { error: m });
  const pub = u => ({ name: u.name, phone: u.phone || '', points: u.points, social: u.social ? u.social.split(':')[0] : '' });
  const session = u => { const t = crypto.randomBytes(24).toString('hex'); db.sessions[t] = { uid: u.id, exp: Date.now() + SESS_TTL }; save(); send(res, 200, { token: t, user: pub(u) }); };

  if (R === 'GET /api/public') return send(res, 200, { settings: S, products: db.products, gifts: db.gifts, social: Object.keys(SOCIAL).map(k => ({ id: k, name: SOCIAL[k] })) });

  if (R === 'POST /api/register') {
    if (limited('reg:' + ip, 10, 36e5)) return bad('Çox cəhd edildi. Bir az sonra yenidən yoxlayın.', 429);
    const name = clean(b.name, 60), pw = String(b.password || ''), ph = readPhone(b.phone);
    if (!name) return bad('Adınızı yazın.');
    if (ph.err) return bad(ph.err);
    if (pw.length < 8) return bad('Şifrə ən az 8 simvol olmalıdır.');
    if (pw.length > 128) return bad('Şifrə çox uzundur (maksimum 128).');
    if (db.users.some(x => x.phone && normDigits(x.phone) === ph.num)) return bad('Bu nömrə ilə artıq qeydiyyat var. Daxil olun.');
    const u = { id: crypto.randomUUID(), name, phone: ph.num, pass: hash(pw), points: 0, date: now() };
    db.users.push(u); return session(u);
  }
  if (R === 'POST /api/login') {
    if (limited('login:' + ip, 15, 6e5)) return bad('Çox cəhd edildi. 10 dəqiqə sonra yenidən yoxlayın.', 429);
    const ph = readPhone(b.phone), pw = String(b.password || '');
    if (ph.err) return bad(ph.err);
    const u = pw.length <= 128 && db.users.find(x => x.phone && normDigits(x.phone) === ph.num);
    if (!u || !check(pw, u.pass)) return bad('Nömrə və ya şifrə səhvdir.', 401);
    return session(u);
  }
  if (R === 'POST /api/social-login') {
    const provider = clean(b.provider, 20).toLowerCase(), sid = clean(b.sid, 100);
    if (!has(SOCIAL, provider)) return bad('Sosial şəbəkə seçilməyib.');
    if (!/^[\w.\-]{8,100}$/.test(sid)) return bad('Giriş məlumatı səhvdir.');
    const key = provider + ':' + sid;
    let u = db.users.find(x => x.social === key);
    if (!u) {
      if (limited('soc:' + ip, 20, 36e5)) return bad('Çox cəhd edildi. Bir az sonra yenidən yoxlayın.', 429);
      u = { id: crypto.randomUUID(), name: SOCIAL[provider] + ' istifadəçisi', phone: '', social: key, pass: hash(crypto.randomBytes(16).toString('hex')), points: 0, date: now() };
      db.users.push(u);
    }
    return session(u);
  }
  if (R === 'GET /api/me') {
    if (!user) return bad('Daxil olun.', 401);
    return send(res, 200, { user: pub(user), orders: db.orders.filter(o => o.uid === user.id).reverse() });
  }

  if (R === 'POST /api/order') {
    const items = (Array.isArray(b.items) ? b.items : []).map(i => { const x = i && db.products.find(y => y.id === i.id); return x && { id: x.id, name: x.name, price: x.price, q: Math.min(20, Math.max(1, i.q | 0)) }; }).filter(Boolean);
    const name = clean(b.name, 60), address = clean(b.address, 200), ph = readPhone(b.phone);
    if (!items.length) return bad('Ən azı bir məhsul seçin.');
    if (!name || !address) return bad('Ad və ünvan lazımdır.');
    if (ph.err) return bad(ph.err);
    if (limited('order:' + ip, 20, 36e5)) return bad('Çox sorğu göndərildi. Bir az sonra yenidən yoxlayın.', 429);
    const total = items.reduce((s, i) => s + i.price * i.q, 0);
    const o = { id: 'S' + Date.now().toString(36).toUpperCase(), type: 'order', uid: user ? user.id : null, name, phone: ph.num, address, note: clean(b.note, 300), items, total, status: 'Yeni', date: now() };
    db.orders.push(o); save();
    notifyTelegram('sales', `🛒 Yeni sifariş ${o.id}\n${name}, +${ph.num}\n${address}\n${items.map(i => `- ${i.name} x${i.q}`).join('\n')}\nCəmi: ${total} ₼${o.note ? '\nQeyd: ' + o.note : ''}${user ? '\n(Qeydiyyatlı müştəri)' : ''}`);
    return send(res, 200, { id: o.id });
  }
  if (R === 'POST /api/redeem') {
    if (!user) return bad('Daxil olun.', 401);
    const g = db.gifts.find(x => x.id === b.giftId), address = clean(b.address, 200);
    if (!g || !address) return bad('Hədiyyə və ünvan lazımdır.');
    // sosial hesabın nömrəsi olmaya bilər — o zaman formadan alınır
    const ph = user.phone ? { num: normDigits(user.phone) } : readPhone(b.phone);
    if (ph.err) return bad('Hədiyyə üçün əlaqə nömrəsi lazımdır. ' + ph.err);
    if (user.points < g.points) return bad('Pointiniz çatmır.');
    user.points -= g.points;
    const o = { id: 'H' + Date.now().toString(36).toUpperCase(), type: 'gift', uid: user.id, name: user.name, phone: ph.num, address, items: [{ name: g.name, q: 1 }], total: 0, spent: g.points, status: 'Yeni', date: now() };
    db.orders.push(o); save();
    notifyTelegram('sales', `🎁 Hədiyyə sorğusu ${o.id}\n${user.name}, +${ph.num}\nHədiyyə: ${g.name} (${g.points} point)\n${address}`);
    return send(res, 200, { id: o.id, user: pub(user) });
  }
  if (R === 'POST /api/sell') {
    const name = clean(b.name, 60), model = clean(b.model, 100), ph = readPhone(b.phone);
    if (!name || !model) return bad('Ad və satmaq istədiyiniz məhsulun modeli lazımdır.');
    if (ph.err) return bad(ph.err);
    if (limited('sell:' + ip, 20, 36e5)) return bad('Çox sorğu göndərildi. Bir az sonra yenidən yoxlayın.', 429);
    const s = { id: 'M' + Date.now().toString(36).toUpperCase(), name, phone: ph.num, model, cond: clean(b.cond, 40), price: clean(b.price, 40), note: clean(b.note, 500), status: 'Yeni', date: now() };
    db.sells.push(s); save();
    notifyTelegram('sales', `📱 Satış müraciəti ${s.id}\n${name}, +${ph.num}\nModel: ${model}\nVəziyyət: ${s.cond}\nİstənilən qiymət: ${s.price}\n${s.note}`);
    return send(res, 200, { id: s.id });
  }

  if (R === 'POST /api/admin/login') {
    if (isLocked()) {
      if (Date.now() - lastBlockedNote > 6e4) { lastBlockedNote = Date.now(); notifyTelegram('admin', '🚫 BLOKLANAN GİRİŞ CƏHDİ\nAdmin paneli artıq bağlıdır.\nIP: ' + ip + '\nVaxt: ' + now()); }
      return bad('Admin paneli bloklanıb. Açmaq üçün serverdə: node unblock.js', 403);
    }
    if (!ADMIN || !eq(b.password || '', ADMIN)) {
      lockAdmin(ip);
      notifyTelegram('admin', '🔒 SƏHV ADMIN GİRİŞİ — 1 CƏHD, PANEL BLOKLANDI\nIP: ' + ip + '\nVaxt: ' + now() + '\nAçmaq üçün serverdə: node unblock.js');
      return bad('Şifrə səhvdir. Admin paneli bloklandı. Açmaq üçün: node unblock.js', 401);
    }
    const t = crypto.randomBytes(24).toString('hex'); admins.set(t, Date.now() + ADMIN_TTL); return send(res, 200, { token: t });
  }
  if (p.startsWith('/api/admin/')) {
    if (isLocked() || !(admins.get(tok) > Date.now())) return bad('Daxil olun.', 401);
    if (R === 'GET /api/admin/data') {
      const sales = readTokenFile(TG_SALES_F), adm = readTokenFile(TG_ADMIN_F);
      return send(res, 200, {
        settings: S, products: db.products, gifts: db.gifts,
        orders: [...db.orders].reverse(), sells: [...db.sells].reverse(),
        users: db.users.map(u => ({ id: u.id, name: u.name, phone: u.phone || '', points: u.points, date: u.date, social: u.social ? u.social.split(':')[0] : '' })),
        telegram: { salesToken: sales.token, salesChat: sales.chat, adminToken: adm.token, adminChat: adm.chat },
        locked: isLocked()
      });
    }
    if (R === 'POST /api/admin/settings') {
      const oldNews = S.news;
      for (const k of SETTINGS) if (k in b) {
        if (k === 'perPoint') S[k] = Math.max(1, +b[k] || 10);
        else if (k === 'whatsapp') { const d = String(b[k] || '').replace(/\D/g, '').slice(0, 15); if (d.length >= 9) S[k] = d; }
        else S[k] = clean(b[k], LONG_SETTINGS.has(k) ? 2000 : 400);
      }
      save();
      if (S.news && S.news !== oldNews) notifyTelegram('sales', '📢 Sayt yeniliyi\n' + (S.newsTitle || 'Yeniliklər') + '\n' + S.news);
      return send(res, 200, { ok: 1 });
    }
    if (R === 'POST /api/admin/telegram') {
      writeTokenFile(TG_SALES_F, b.salesToken, b.salesChat);
      writeTokenFile(TG_ADMIN_F, b.adminToken, b.adminChat);
      return send(res, 200, { ok: 1 });
    }
    if (R === 'POST /api/admin/telegram-test') {
      const [sales, adm] = await Promise.all([
        notifyTelegram('sales', '✅ Test: satış botu işləyir.'),
        notifyTelegram('admin', '✅ Test: admin botu işləyir.')
      ]);
      return send(res, 200, { sales, admin: adm });
    }
    if (R === 'POST /api/admin/item') {
      if (!has(FIELDS, b.coll)) return bad('Səhv bölmə.');
      const F = FIELDS[b.coll], src = b.item && typeof b.item === 'object' ? b.item : null;
      if (!src) return bad('Məlumat göndərilməyib.');
      const it = {}; for (const k in F) it[k] = F[k] === 'n' ? Math.max(0, +src[k] || 0) : clean(src[k], F[k] === 'l' ? 2000 : 200);
      if (!it.name) return bad('Ad yazın.');
      if (!imgOk(it.img)) return bad('Şəkil yolu /img/fayl.jpg şəklində və ya https:// ilə başlamalıdır.');
      if (b.coll === 'products' && !it.cat) it.cat = 'Digər';
      const list = db[b.coll], i = list.findIndex(x => x.id === src.id);
      if (i >= 0) list[i] = { ...list[i], ...it }; else list.push({ id: 'x' + crypto.randomBytes(4).toString('hex'), ...it });
      save();
      notifyTelegram('sales', (i >= 0 ? '✏️ Saytda dəyişiklik: ' : '🆕 Saytda yenilik: ') + (b.coll === 'gifts' ? 'hədiyyə' : 'məhsul') + ' — ' + it.name);
      return send(res, 200, { ok: 1 });
    }
    if (R === 'POST /api/admin/delete') {
      if (!has(FIELDS, b.coll)) return bad('Səhv bölmə.');
      db[b.coll] = db[b.coll].filter(x => x.id !== b.id); save(); return send(res, 200, { ok: 1 });
    }
    if (R === 'POST /api/admin/delete-user') {
      db.users = db.users.filter(x => x.id !== b.id);
      for (const k of Object.keys(db.sessions)) if (db.sessions[k].uid === b.id) delete db.sessions[k];
      save(); return send(res, 200, { ok: 1 });
    }
    if (R === 'POST /api/admin/status') {
      if (!has(STATUS, b.kind)) return bad('Səhv sorğu.');
      const x = db[b.kind].find(y => y.id === b.id);
      if (!x || !STATUS[b.kind].includes(b.status)) return bad('Səhv sorğu.');
      x.status = b.status;
      const u = x.uid && db.users.find(y => y.id === x.uid);
      if (u && x.type === 'order') {
        if (b.status === 'Tamamlandı' && !x.awarded) { x.awarded = Math.floor(x.total / (+S.perPoint || 10)); u.points += x.awarded; }
        else if (b.status === 'Ləğv edildi' && x.awarded) { u.points = Math.max(0, u.points - x.awarded); x.awarded = 0; }
      }
      if (u && x.type === 'gift') {
        if (b.status === 'Ləğv edildi' && !x.refunded) { x.refunded = true; u.points += x.spent; }
        else if (b.status !== 'Ləğv edildi' && x.refunded) { x.refunded = false; u.points = Math.max(0, u.points - x.spent); }
      }
      save(); return send(res, 200, { ok: 1 });
    }
  }
  return bad('Tapılmadı', 404);
}

// ---------- Statik fayllar ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const notFound = (res, msg) => { res.writeHead(404, { ...HEADERS, 'content-type': 'text/html; charset=utf-8' }); res.end('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px"><h1>Tapılmadı</h1><p>' + msg + '</p><a href="/">Ana səhifəyə qayıt</a></body></html>'); };
function stat(res, p) {
  const rel = p === '/' ? 'index.html' : p === '/admin' ? 'admin.html' : p.replace(/^\/+/, '');
  const f = path.normalize(path.join(PUB, rel));
  if (rel.includes('\0') || !f.startsWith(PUB + path.sep)) return notFound(res, 'Səhifə mövcud deyil.');
  let st; try { st = fs.statSync(f); } catch { st = null; }
  if (!st || !st.isFile()) { console.log('[404]', p); return notFound(res, 'Fayl tapılmadı. Serveri layihə qovluğundan <code>node server.js</code> ilə işə salın.'); }
  const ext = path.extname(f).toLowerCase();
  res.writeHead(200, { ...HEADERS, 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(f).pipe(res);
}
const body = req => new Promise(ok => {
  let d = '';
  req.on('data', c => { d += c; if (d.length > 2e5) { ok({}); req.destroy(); } });
  req.on('end', () => { try { const o = d ? JSON.parse(d) : {}; ok(o && typeof o === 'object' && !Array.isArray(o) ? o : {}); } catch { ok({}); } });
  req.on('error', () => ok({}));
  req.on('close', () => ok({}));
});

http.createServer(async (req, res) => {
  try {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, { error: 'Səhv ünvan' }); }
    if (p.startsWith('/api/')) return await api(req, res, p, req.method === 'GET' ? {} : await body(req));
    stat(res, p);
  } catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { error: 'Server xətası' }); else res.end(); }
}).listen(PORT, () => {
  const ok = fs.existsSync(path.join(PUB, 'index.html'));
  console.log('\n========================================');
  if (!ok) {
    console.log('XƏTA: public/index.html tapılmadı!');
    console.log('Serveri mütləq layihə qovluğundan işə salın:  node server.js');
  } else {
    console.log('Sayt:  http://localhost:' + PORT);
    console.log('Admin: http://localhost:' + PORT + '/admin');
  }
  if (!ADMIN) console.log('DİQQƏT: .env-də ADMIN_PASSWORD yazılmayıb — admin panelə girmək olmaz');
  if (isLocked()) console.log('DİQQƏT: Admin paneli bloklanıb. Açmaq üçün: node unblock.js');
  console.log('========================================\n');
});
