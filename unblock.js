// Admin giriş blokunu açmaq üçün: node unblock.js
const fs = require('fs'), path = require('path'), f = path.join(__dirname, 'data', 'admin.lock');
try { fs.unlinkSync(f); console.log('Admin giriş blokdan çıxarıldı.'); } catch { console.log('Blok yoxdur, giriş artıq açıqdır.'); }
