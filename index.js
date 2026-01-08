const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises; // Pakai versi Async (Anti-Lag)
const fsSync = require('fs');      // Untuk cek file ada/tidak saja

// --- KONFIGURASI UTAMA ---
const BOT_START_TIME = Math.floor(Date.now() / 1000);
const COOLDOWN_IN_MS = 3000;
const cooldowns = new Map();

// --- DATABASE IN-MEMORY (RAM) ---
// Data dimuat ke sini biar ngebut, gak baca file terus-terusan
let DB = {
    config: { welcome: true, goodbye: true },
    shop_status: {}, // GIG, BOOSTER, VILOG
    ptpt_sessions: {},
    admins: [ 
        '273838558449745', '256723633852445', '189601952063685' 
    ]
};

const DB_FILE = './database_v2.json';

// --- FUNGSI DATABASE PINTAR ---
// 1. Load Database saat Start
async function loadDatabase() {
    if (fsSync.existsSync(DB_FILE)) {
        try {
            const raw = await fs.readFile(DB_FILE, 'utf8');
            DB = { ...DB, ...JSON.parse(raw) }; // Gabung default + data file
            console.log('✅ Database dimuat ke Memory (RAM).');
        } catch (e) {
            console.error('❌ Gagal baca DB, membuat baru...', e);
            saveDatabase();
        }
    } else {
        console.log('📝 Membuat database baru...');
        saveDatabase();
    }
}

// 2. Save Database (Async - Tidak Bikin Lag)
async function saveDatabase() {
    try {
        await fs.writeFile(DB_FILE, JSON.stringify(DB, null, 2));
    } catch (e) {
        console.error('❌ Gagal menyimpan DB:', e);
    }
}

// --- TEMPLATES ---
const SEONE_MSG_BODY = `*SeoneStore.ID* 
✅Murah, Aman & Trusted 100%

⚡ Proses Cepat (1-10 Menit)
💳 Bayar via : Qris
⏰ Open Daily: 05.00 - 23.00 WIB

⭐ Ketik *.help* untuk info lebih lengkap
*# ADMIN NEVER DM FIRST!*
---------------------------------------`;

const PAY_MSG = `*⚠️ PERINGATAN:*
Pembayaran hanya valid jika dilakukan melalui *QRIS resmi* ini.
Transfer melalui DM, link pribadi, atau QR lain = otomatis *dianggap tidak sah.*
Segala bentuk salah transfer *bukan tanggung jawab admin.*`;

const VILOG_TNC = `🔐 *INFORMASI LENGKAP VIA LOGIN (VILOG)* 🔐

1️⃣ *CARA KERJA:*
• Pembeli: Memberikan Username dan Password.
• Admin akan login ke akunmu untuk memproses topup secara manual.
• Selesai: Admin logout.

2️⃣ *KEAMANAN & RISIKO:*
• Tenang, data akunmu dijamin *AMAN 100% & PRIVASI TERJAGA*.
• Kami *SANGAT MENYARANKAN* segera *Ganti Password* setelah pesanan selesai.

3️⃣ *PERSETUJUAN:*
• Dengan melakukan pembayaran, berarti kamu *SETUJU*.

4️⃣ *PENGIRIMAN DATA:*
• Kirim Username & Password *HANYA MELALUI DM/JAPRI* ke Admin.
• ❌ Jangan kirim data akun di Grup!

# *INGAT! ADMIN NEVER DM FIRST!* 🚫`;

// === MENU HELP ===
const HELP_MEMBER = `🛠️ *BANTUAN SEONE STORE* 🛠️
Bingung mau ngapain? Cek daftar command di bawah ini:
----------------------------------
✤ *.PAY*
✤ *.ADMIN* :List Kontak Admin
✤ *.GIG*
✤ *.BOOSTER*
✤ *.VILOG* :Via Login + TnC
✤ *.PTPTLIST* :Join Sesi PTPT
✤ *.PTPTUPDATE* :Cek Daftar Sesi Aktif
✤ *.HELP*
✤ *.PING*`;

const HELP_ADMIN_ONLY = `
---------ADMIN ONLY------------
✤ *.JOIN ON/OFF* :Atur Auto Welcome
✤ *.LEAVE ON/OFF* :Atur Auto Goodbye
✤ *.GIGUPDATE* 
✤ *.GIGRESET* 
✤ *.GIGCLOSE*
✤ *.BOOSTERUPDATE* 
✤ *.BOOSTERRESET* 
✤ *.BOOSTERCLOSE*
✤ *.VILOGUPDATE* 
✤ *.VILOGRESET* 
✤ *.VILOGCLOSE*
✤ *.PTPTOPEN* :Buka Sesi Baru
✤ *.PTPTCLOSE* :Tutup Sesi
✤ *.PTPTSET* :Edit Jam Sesi
✤ *.PTPTPAID* :Konfirmasi Bayar 
✤ *.PTPTREMOVE* :Hapus Member
✤ *.PTPTRESET* :Hapus Sesi
✤ *.P (teks)*`;

const HELP_FOOTER = `
_SeoneStore.ID - Happy Shopping!_ 🔥`;

// Settingan Bot
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: [ '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process' ]
    }
});

client.on('qr', (qr) => { qrcode.generate(qr, { small: true }); console.log('Scan QR Code...'); });
client.on('ready', async () => { 
    console.log('Mantap! Bot sudah ONLINE dan siap tempur!');
    await loadDatabase(); // Load data dulu sebelum terima pesan
});

// --- FUNGSI BANTUAN (HELPER) ---

function isUserAdmin(msg) {
    let userID = (msg.author || msg.from).replace('@c.us', '').replace('@g.us', ''); 
    if(msg.from.includes('@g.us') && msg.author) userID = msg.author.split('@')[0];
    else userID = msg.from.split('@')[0];
    
    return DB.admins.includes(userID);
}

function getWaktuIndonesia() {
    const now = new Date();
    const optionsDate = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' };
    return { date: now.toLocaleDateString('id-ID', optionsDate), time: now.toLocaleTimeString('id-ID', optionsTime) };
}

// Helper: Ambil semua member (Paralel)
async function getMentionsAll(chat) {
    const mentions = await Promise.all(chat.participants.map(async (p) => {
        try { return await client.getContactById(p.id._serialized); } catch { return null; }
    }));
    return mentions.filter(c => c !== null);
}

// Helper: Kirim Pesan dengan Retry (Anti Gagal)
async function sendMessageWithRetry(target, content, options = {}, retries = 3) {
    try {
        await target.sendMessage(content, options);
    } catch (error) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            await sendMessageWithRetry(target, content, options, retries - 1);
        }
    }
}

async function kirimSapaanDenganGambar(chatTarget, contactToTag) {
    let picUrl = null;
    try { picUrl = await chatTarget.getProfilePicUrl(); } catch (err) {}
    if (!picUrl) { try { picUrl = await client.getProfilePicUrl(client.info.wid._serialized); } catch (err) {} }

    let finalCaption = SEONE_MSG_BODY;
    let options = {};

    if (contactToTag) {
        finalCaption = `Yo @${contactToTag.id.user}! Welcome to \n` + SEONE_MSG_BODY;
        options.mentions = [contactToTag];
    }
    options.caption = finalCaption;

    try {
        if (picUrl) {
            const media = await MessageMedia.fromUrl(picUrl);
            await sendMessageWithRetry(chatTarget, media, options);
        } else {
            await sendMessageWithRetry(chatTarget, finalCaption, options);
        }
    } catch(e) {}
}

// --- LOGIC UTAMA (MEMAKAI RAM DB) ---
async function handleStatusView(msg, serviceName, imagePath) {
    try {
        const data = DB.shop_status[serviceName] || { status: 'OPEN', date: 'Belum update', time: '-' };
        
        if (data.status === 'CLOSED') {
            msg.reply(`🚫 *${serviceName} KOSONG / TUTUP* 🚫\n\nMaaf, layanan sedang *TUTUP*.\n⏰ *Closed sejak:* ${data.time} WIB\n_Tunggu kabar selanjutnya ya 😙_`);
            return;
        }

        const TPL = `📢 *${serviceName} PRICELIST* 📢\n🗓️ *Update:* ${data.date}\n🕛 *Pukul:* ${data.time} WIB\n\nIni pricelist terbaru.\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*\n\n📝 *NOTE:*\nKirim bukti & tag admin ya 😙`;
        
        if (fsSync.existsSync(imagePath)) await sendMessageWithRetry(client, msg.from, MessageMedia.fromFilePath(imagePath), { caption: TPL });
        else msg.reply(`⚠️ Admin belum upload Price List ${serviceName}.`);

    } catch (error) { console.error(error); msg.reply('❌ Error system.'); }
}

async function handleStatusUpdate(msg, chat, serviceName, imagePath, isReset = false, isClose = false) {
    const { date, time } = getWaktuIndonesia();
    try {
        if (isReset) {
            delete DB.shop_status[serviceName];
            await saveDatabase();
            if(fsSync.existsSync(imagePath)) fsSync.unlinkSync(imagePath);
            msg.reply(`✅ ${serviceName} berhasil di-RESET.`);
            return;
        }

        if (isClose) {
            DB.shop_status[serviceName] = { status: 'CLOSED', date, time };
            await saveDatabase();
            msg.reply(`⛔ *${serviceName} CLOSED!* Member akan melihat pesan tutup.`);
            return;
        }

        // UPDATE OPEN
        DB.shop_status[serviceName] = { status: 'OPEN', date, time };
        await saveDatabase();
        
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            if(media) await fs.writeFile(imagePath, media.data, 'base64');
        }

        const mentions = await getMentionsAll(chat);
        const TPL = `📢 *${serviceName} UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *READY/OPEN!*\n\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*`;
        
        if(fsSync.existsSync(imagePath)) await sendMessageWithRetry(chat, MessageMedia.fromFilePath(imagePath), { caption: TPL, mentions: mentions });
        else await sendMessageWithRetry(chat, TPL, { mentions: mentions });

    } catch (error) { console.error(error); msg.reply('❌ Gagal update.'); }
}

// Otak Bot
client.on('message', async (message) => {
    if (message.timestamp < BOT_START_TIME) return; 
    const msg = message.body.toLowerCase();

    // COOLDOWN PER USER
    if (msg.startsWith('.')) {
        const sender = message.from;
        const now = Date.now();
        if (cooldowns.has(sender)) {
            if (now < cooldowns.get(sender) + COOLDOWN_IN_MS) return;
        }
        cooldowns.set(sender, now);
        setTimeout(() => cooldowns.delete(sender), COOLDOWN_IN_MS);
    } else { return; }

    // --- COMMAND MEMBER ---
    if(msg === '.ping') {
        const latency = Date.now() - (message.timestamp * 1000);
        message.reply(`Pong! 🏓\nRespond Time: *${latency}ms*`);
    }
    
    if(msg === '.help') {
        const content = isUserAdmin(message) ? (HELP_MEMBER + HELP_ADMIN_ONLY + HELP_FOOTER) : (HELP_MEMBER + HELP_FOOTER);
        message.reply(content);
    }

    if(msg === '.admin') {
        message.reply(`*LIST ADMIN SEONE STORE*\n-------------------------------\n*1. Zuka* ✦ 081161626164\n*2. Linnn* ✦ 081260809729\n*3. Genky* ✦ 082185523432\n-------------------------------\n_Chat sopan, no spam, no call!_ 😉`);
    }

    if(msg === '.pay') {
        try {
            const media = MessageMedia.fromFilePath('./QRIS.png');
            await sendMessageWithRetry(client, message.from, media, { caption: PAY_MSG + "\n\n🔔 *Mohon tag admin setelah transfer!*" });
        } catch (error) { message.reply('Mohon maaf, gambar QRIS sedang bermasalah.'); }
    }

    // --- FITUR VIEW (DB BASED) ---
    if(msg === '.gig') await handleStatusView(message, 'GIG', './pricelist.png');
    if(msg === '.booster') await handleStatusView(message, 'BOOSTER', './pricelist_booster.png');
    if(msg === '.vilog') {
        try {
            const data = DB.shop_status['VILOG'] || { status: 'OPEN', date: 'Belum update' };
            if (data.status === 'CLOSED') {
                message.reply(`🚫 *VILOG CLOSED* 🚫\nLayanan sedang tutup sementara.`);
                return;
            }
            const TPL = `🔐 *VIA LOGIN PRICELIST* 🔐\n🗓️ *Update:* ${data.date}\n\n${VILOG_TNC}\n\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*`;
            
            if (fsSync.existsSync('./pricelist_vilog.png')) await sendMessageWithRetry(client, message.from, MessageMedia.fromFilePath('./pricelist_vilog.png'), { caption: TPL });
            else message.reply('⚠️ Admin belum upload Price List Vilog.');
        } catch(e) { message.reply('Error sistem.'); }
    }

    // --- PTPT LIST (JOIN) ---
    if (msg.startsWith('.ptptlist')) {
        let txt = message.body.slice(10).trim();
        if (!txt) { message.reply(`⚠️ Format: .ptptlist [Kode] [Username]`); return; }
        
        const args = txt.split(' ');
        let code = args[0].toUpperCase();
        let user = args.slice(1).join(' ');

        try {
            // Cek Session
            if (!DB.ptpt_sessions[code]) { message.reply(`⚠️ Sesi *${code}* tidak ditemukan. Cek .ptptupdate`); return; }
            const session = DB.ptpt_sessions[code];
            
            if (!user) { message.reply(`⚠️ Masukkan username! Contoh: .ptptlist ${code} ProPlayer`); return; }
            if (session.is_closed) { message.reply(`❌ Sesi *${code}* sudah DITUTUP Admin.`); return; }
            if (session.participants.length >= 20) { message.reply(`❌ Slot sesi *${code}* sudah penuh (20/20)!`); return; }
            
            // Cek Duplikat
            const isExist = session.participants.some(p => p.roblox.toLowerCase() === user.toLowerCase());
            if (isExist) { message.reply(`⚠️ Username *${user}* sudah terdaftar di sesi ini.`); return; }

            const contact = await message.getContact();
            const waName = contact.pushname || contact.number;
            const waId = contact.id._serialized;

            // Masukkan Data ke RAM & Save
            session.participants.push({ name: waName, roblox: user, wa_id: waId, is_paid: false });
            await saveDatabase();

            // Tampilkan List
            let list = '';
            for (let i = 0; i < 20; i++) {
                let p = session.participants[i];
                list += `${i+1}. ${p ? `${p.name} / ${p.roblox}${p.is_paid ? ' ✅' : ''}` : ''}\n`;
            }
            const footer = `\n-------------------------------\ncara bayar: ketik *.pay* untuk memunculkan qris\nnote: jangan lupa kirim buktinya ke sini dan tag admin juga ya😙`;
            const TPL = `📢 SESSION INFO (${code})\n• Jenis: ${session.type}\n• Waktu: ${session.time}\n• Status: OPEN (${session.participants.length}/20)\n\n--------LIST MEMBER---------\nUSN Wa / USN rblox\n${list}\n*CARA JOIN???*\n_ketik : .ptptlist ${code} (username)_${footer}`;
            await message.reply(TPL);

        } catch (error) { console.error(error); message.reply('❌ Error system.'); }
    }

    // --- PTPT UPDATE ---
    if(msg.startsWith('.ptptupdate')) {
        const code = message.body.slice(12).trim().split(' ')[0].toUpperCase();
        try {
            if (code) {
                if (!DB.ptpt_sessions[code]) { message.reply(`⚠️ Sesi ${code} tidak ada.`); return; }
                const session = DB.ptpt_sessions[code];
                
                let list = '';
                for (let i = 0; i < 20; i++) {
                    let p = session.participants[i];
                    list += `${i+1}. ${p ? `${p.name} / ${p.roblox}${p.is_paid ? ' ✅' : ''}` : ''}\n`;
                }
                let statusTxt = session.is_closed ? 'CLOSED (DITUTUP)' : (session.participants.length >= 20 ? 'FULL' : `OPEN (${session.participants.length}/20)`);
                const footer = `\n-------------------------------\ncara bayar: ketik *.pay* untuk memunculkan qris\nnote: jangan lupa kirim buktinya ke sini dan tag admin juga ya😙`;
                const TPL = `📢 SESSION INFO (${code})\n• Jenis: ${session.type}\n• Waktu: ${session.time}\n• Status: ${statusTxt}\n\n--------LIST MEMBER---------\nUSN Wa / USN rblox\n${list}\n*CARA JOIN???*\n_ketik : .ptptlist ${code} (username)_${footer}`;
                
                if (fsSync.existsSync('./ptpt_image.png')) await sendMessageWithRetry(client, message.from, MessageMedia.fromFilePath('./ptpt_image.png'), { caption: TPL });
                else await message.reply(TPL);

            } else {
                const keys = Object.keys(DB.ptpt_sessions);
                if (keys.length === 0) { message.reply('⚠️ Belum ada sesi aktif.'); return; }
                
                let txt = `📋 *DAFTAR SESI AKTIF:*\n\n`;
                keys.forEach(k => {
                    const s = DB.ptpt_sessions[k];
                    let lbl = s.is_closed ? "[CLOSED] ❌" : (s.participants.length >= 20 ? "[FULL]" : "[OPEN]");
                    txt += `🔹 *${k}* (${s.type}) ${lbl}\n   📅 ${s.time}\n   👥 ${s.participants.length}/20\n   👉 .ptptlist ${k} [User]\n\n`;
                });
                await message.reply(txt);
            }
        } catch (e) { console.error(e); message.reply('❌ Error.'); }
    }

    // --- AREA ADMIN ---
    if(isUserAdmin(message)) {
        // SETTINGS JOIN/LEAVE
        if (msg === '.join on') { DB.config.welcome = true; await saveDatabase(); message.reply('✅ Auto Welcome: ON'); }
        if (msg === '.join off') { DB.config.welcome = false; await saveDatabase(); message.reply('🚫 Auto Welcome: OFF'); }
        if (msg === '.leave on') { DB.config.goodbye = true; await saveDatabase(); message.reply('✅ Auto Goodbye: ON'); }
        if (msg === '.leave off') { DB.config.goodbye = false; await saveDatabase(); message.reply('🚫 Auto Goodbye: OFF'); }

        if (msg === '.testgreet') { const contact = await message.getContact(); await kirimSapaanDenganGambar(await message.getChat(), contact); }

        // BROADCAST
        if(msg.startsWith('.p ')) {
            const txt = message.body.slice(3).trim();
            if(!txt) return;
            const chat = await message.getChat();
            const mentions = await getMentionsAll(chat);
            await sendMessageWithRetry(chat, txt, { mentions });
        }

        // GIG/BOOSTER/VILOG ADMIN
        if(msg === '.gigupdate') await handleStatusUpdate(message, await message.getChat(), 'GIG', './pricelist.png');
        if(msg === '.gigclose') await handleStatusUpdate(message, null, 'GIG', null, false, true);
        if(msg === '.gigreset') await handleStatusUpdate(message, null, 'GIG', './pricelist.png', true);

        if(msg === '.boosterupdate') await handleStatusUpdate(message, await message.getChat(), 'BOOSTER', './pricelist_booster.png');
        if(msg === '.boosterclose') await handleStatusUpdate(message, null, 'BOOSTER', null, false, true);
        if(msg === '.boosterreset') await handleStatusUpdate(message, null, 'BOOSTER', './pricelist_booster.png', true);

        if(msg === '.vilogupdate') await handleStatusUpdate(message, await message.getChat(), 'VILOG', './pricelist_vilog.png');
        if(msg === '.vilogclose') await handleStatusUpdate(message, null, 'VILOG', null, false, true);
        if(msg === '.vilogreset') await handleStatusUpdate(message, null, 'VILOG', './pricelist_vilog.png', true);

        // PTPT ADMIN COMMANDS
        if(msg.startsWith('.ptptopen')) {
            const body = message.body.slice(9).trim();
            const space = body.indexOf(' ');
            if (space === -1) { message.reply('⚠️ Format: .ptptopen [KODE] [Jenis], [Waktu]'); return; }
            const code = body.substring(0, space).toUpperCase();
            const details = body.substring(space + 1).split(',').map(s => s.trim());
            if (details.length < 2) { message.reply('⚠️ Format salah. Pisahkan jenis & waktu dgn koma.'); return; }
            
            DB.ptpt_sessions[code] = { type: details[0], time: details[1], is_closed: false, participants: [] };
            await saveDatabase();

            if (message.hasMedia) {
                const m = await message.downloadMedia();
                if(m) await fs.writeFile('./ptpt_image.png', m.data, 'base64');
            }
            const footer = `\n-------------------------------\ncara bayar: ketik *.pay* untuk memunculkan qris\nnote: jangan lupa kirim buktinya ke sini dan tag admin juga ya😙`;
            let list = ''; for (let i = 1; i <= 20; i++) list += `${i}.\n`;
            const TPL = `📢 SESSION INFO OPEN (${code})\n• Jenis: ${details[0]}\n• Waktu: ${details[1]}\n• Status: OPEN (0/20)\n\n--------LIST MEMBER---------\nUSN Wa / USN rblox\n${list}*CARA JOIN ???*\n_ketik : .ptptlist ${code} (username)_${footer}`;
            
            const chat = await message.getChat();
            const mentions = await getMentionsAll(chat);
            if (fsSync.existsSync('./ptpt_image.png')) await sendMessageWithRetry(chat, MessageMedia.fromFilePath('./ptpt_image.png'), { caption: TPL, mentions });
            else await sendMessageWithRetry(chat, TPL, { mentions });
        }

        if(msg.startsWith('.ptptclose')) {
            const code = message.body.slice(10).trim().toUpperCase();
            if(!DB.ptpt_sessions[code]) { message.reply('❌ Sesi tak ditemukan.'); return; }
            DB.ptpt_sessions[code].is_closed = true;
            await saveDatabase();
            
            const chat = await message.getChat();
            const mentions = await getMentionsAll(chat);
            await sendMessageWithRetry(chat, `⛔ Sesi *${code}* berhasil DITUTUP. Member tidak bisa join lagi.`, {mentions});
        }

        if(msg.startsWith('.ptptset')) {
            const body = message.body.slice(8).trim();
            const space = body.indexOf(' ');
            if (space === -1) return;
            const code = body.substring(0, space).toUpperCase();
            const newTime = body.substring(space + 1).trim();
            if(!DB.ptpt_sessions[code]) { message.reply('❌ Sesi tak ditemukan.'); return; }
            DB.ptpt_sessions[code].time = newTime;
            await saveDatabase();
            message.reply(`✅ Waktu sesi ${code} diupdate.`);
        }

        if(msg.startsWith('.ptptpaid')) {
            const body = message.body.slice(9).trim();
            const space = body.indexOf(' ');
            if (space === -1) return;
            const code = body.substring(0, space).toUpperCase();
            const nums = body.substring(space + 1).split(',').map(n => parseInt(n.trim()) - 1);
            
            if(!DB.ptpt_sessions[code]) { message.reply('❌ Sesi tak ditemukan.'); return; }
            const session = DB.ptpt_sessions[code];
            
            let updated = 0;
            nums.forEach(i => { 
                if (session.participants[i]) { session.participants[i].is_paid = true; updated++; } 
            });
            if(updated > 0) await saveDatabase();
            
            // Repost List
            let list = '';
            for (let i = 0; i < 20; i++) {
                let p = session.participants[i];
                list += `${i+1}. ${p ? `${p.name} / ${p.roblox}${p.is_paid ? ' ✅' : ''}` : ''}\n`;
            }
            const footer = `\n-------------------------------\ncara bayar: ketik *.pay* untuk memunculkan qris\nnote: jangan lupa kirim buktinya ke sini dan tag admin juga ya😙`;
            const TPL = `📢 *PAYMENT CONFIRMED (${code})*\n• Jenis: ${session.type}\n• Waktu: ${session.time}\n\n--------LIST MEMBER---------\nUSN Wa / USN rblox\n${list}_LUNAS!_ ✅\n*CARA JOIN ???*\n_ketik : .ptptlist ${code} (username)_${footer}`;
            
            const chat = await message.getChat();
            const mentions = await getMentionsAll(chat);
            if (fsSync.existsSync('./ptpt_image.png')) await sendMessageWithRetry(chat, MessageMedia.fromFilePath('./ptpt_image.png'), { caption: TPL, mentions });
            else await sendMessageWithRetry(chat, TPL, { mentions });
        }

        if(msg.startsWith('.ptptreset')) {
            const code = message.body.slice(10).trim().toUpperCase();
            if (code === 'ALL') {
                DB.ptpt_sessions = {};
                await saveDatabase();
                message.reply('✅ Reset ALL PTPT Data.');
            } else {
                if(DB.ptpt_sessions[code]) {
                    delete DB.ptpt_sessions[code];
                    await saveDatabase();
                    message.reply(`✅ Sesi ${code} dihapus.`);
                } else { message.reply('❌ Sesi tak ditemukan.'); }
            }
        }
        
        if(msg.startsWith('.ptptremove')) {
             const body = message.body.slice(11).trim();
             const space = body.indexOf(' ');
             const code = body.substring(0, space).toUpperCase();
             const idx = parseInt(body.substring(space + 1).trim()) - 1;
             
             if(DB.ptpt_sessions[code] && DB.ptpt_sessions[code].participants[idx]) {
                 DB.ptpt_sessions[code].participants.splice(idx, 1);
                 await saveDatabase();
                 message.reply(`✅ Member no ${idx+1} dihapus dari ${code}.`);
             } else { message.reply('⚠️ Slot kosong/tidak ada.'); }
        }
    }
});

// === EVENT HANDLER ===
client.on('group_join', async (notif) => {
    if (notif.timestamp < BOT_START_TIME) return;
    if (!DB.config.welcome) return;
    try {
        const chat = await notif.getChat();
        const contact = await client.getContactById(notif.recipientIds[0]); 
        await kirimSapaanDenganGambar(chat, contact);
    } catch (e) {}
});

client.on('group_leave', async (notif) => {
    if (notif.timestamp < BOT_START_TIME) return;
    if (!DB.config.goodbye) return;
    try {
        const chat = await notif.getChat();
        const contact = await client.getContactById(notif.recipientIds[0]);
        const text = `@${contact.id.user} telah keluar dari grup, jangan lupa bawakan gorengan dan es teh manis se truk untuk member member ku jika kembali lagi 👋`;
        await sendMessageWithRetry(chat, text, { mentions: [contact] });
    } catch (e) {}
});

client.initialize();