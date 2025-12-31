const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs'); 

// --- PENGATURAN WAKTU & SPAM ---
const BOT_START_TIME = Math.floor(Date.now() / 1000);

let lastCommandTime = 0; 
const COOLDOWN_IN_MS = 3000; // Delay 3 Detik

// --- DATABASE SETTING (JOIN/LEAVE) ---
let BOT_SETTINGS = { enableWelcome: true, enableGoodbye: true };

if (fs.existsSync('./bot_settings.json')) {
    try { BOT_SETTINGS = JSON.parse(fs.readFileSync('./bot_settings.json', 'utf8')); } 
    catch (e) { console.log('Gagal load setting, pakai default.', e); }
} else { fs.writeFileSync('./bot_settings.json', JSON.stringify(BOT_SETTINGS)); }

function saveSettings() { fs.writeFileSync('./bot_settings.json', JSON.stringify(BOT_SETTINGS)); }

// --- KONFIGURASI ADMIN (Auth) ---
// ID ini untuk akses command admin (pastikan ID-nya benar sesuai WA masing-masing)
const LIST_ADMIN = [ 
    '273838558449745',    // ID User Linnn
    '256723633852445',    // ID User Genky
    '189601952063685'     // ID User Hayyu/Zuka
];

// --- DATABASE PESAN & TEMPLATE ---
const SEONE_MSG_BODY = `*SeoneStore.ID* ✅Murah, Aman & Trusted 100%

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

const PTPT_FOOTER = `
-------------------------------
cara bayar: ketik *.pay* untuk memunculkan qris
note: jangan lupa kirim buktinya ke sini dan tag admin juga ya😙`;

const VILOG_TNC = `🔐 *INFORMASI LENGKAP VIA LOGIN (VILOG)* 🔐

1️⃣ *CARA KERJA:*
• Pembeli: Memberikan Username dan Password (terkadang butuh kode verifikasi 2 langkah atau kode backup).
• Admin akan login ke akunmu untuk memproses topup secara manual.
• Selesai: Setelah Robux masuk, penjual akan logout (keluar) dari akun tersebut.

2️⃣ *KEAMANAN & RISIKO:*
• Tenang, data akunmu dijamin *AMAN 100% & PRIVASI TERJAGA* di tangan kami.
• Namun, sebagai standar keamanan digital yang baik, kami *SANGAT MENYARANKAN* agar kamu segera *Ganti Password* setelah pesanan selesai.
• Ini bukan untuk menakuti, tapi demi kenyamanan bersama dan agar hati kamu tenang! 😉🛡️

3️⃣ *PERSETUJUAN:*
• Dengan melakukan pembayaran, berarti kamu *SETUJU* dengan semua prosedur di atas.

4️⃣ *PENGIRIMAN DATA:*
• Silakan kirim Username & Password *HANYA MELALUI DM/JAPRI* ke Admin yang bersangkutan secara langsung.
• ❌ Jangan pernah kirim data akun di Grup!

# *INGAT! ADMIN NEVER DM FIRST!* 🚫
_(Admin tidak akan pernah chat kamu duluan untuk minta data/uang)_`;

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
✤ *.PTPTCLOSE* :Tutup Sesi Biar Ga Ada yg Join
✤ *.PTPTSET* :Edit Jam Sesi
✤ *.PTPTPAID* :Konfirmasi Bayar 
✤ *.PTPTREMOVE* :Hapus Member
✤ *.PTPTRESET* :Tutup/Hapus Sesi
✤ *.P (teks)*`;

const HELP_FOOTER = `
_SeoneStore.ID - Happy Shopping!_ 🔥`;

// Settingan Bot
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process'
        ],
    }
});

client.on('qr', (qr) => { qrcode.generate(qr, { small: true }); console.log('Scan QR Code...'); });
client.on('ready', () => { console.log('Mantap! Bot sudah ONLINE dan siap tempur!'); });

// --- FUNGSI BANTUAN (HELPER) ---

function isUserAdmin(msg) {
    let userID = null;
    if (msg.from.includes('@g.us')) {
        if (msg.author) userID = msg.author.split('@')[0].split(':')[0];
    } else {
        userID = msg.from.split('@')[0];
    }
    if (LIST_ADMIN.includes(userID)) return true;
    return false;
}

function getWaktuIndonesia() {
    const now = new Date();
    const optionsDate = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' };
    return { date: now.toLocaleDateString('id-ID', optionsDate), time: now.toLocaleTimeString('id-ID', optionsTime) };
}

// === HELPER SAKTI: AMBIL SEMUA MEMBER CEPAT (PARALEL) ===
async function getMentionsAll(chat) {
    const mentions = await Promise.all(chat.participants.map(async (participant) => {
        try {
            return await client.getContactById(participant.id._serialized);
        } catch (e) {
            return null;
        }
    }));
    return mentions.filter(contact => contact !== null);
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

    if (picUrl) {
        const media = await MessageMedia.fromUrl(picUrl);
        await chatTarget.sendMessage(media, options);
    } else {
        await chatTarget.sendMessage(finalCaption, options);
    }
}

// Otak Bot
client.on('message', async (message) => {
    // ANTI SPAM
    if (message.timestamp < BOT_START_TIME) return; 

    const msg = message.body.toLowerCase();

    // COOLDOWN
    if (msg.startsWith('.')) {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastCommandTime;
        if (timeDiff < COOLDOWN_IN_MS) {
            message.reply('uupppssss, seseorang baru saja menggunakan command. tunggu 3detik lagi');
            return; 
        }
        lastCommandTime = currentTime;
    } else { return; }

    // --- COMMAND MEMBER ---
    if(msg === '.ping') {
        // Ambil waktu pesan dikirim (dikali 1000 karena timestamp WA dalam detik)
        const messageTimestamp = message.timestamp * 1000; 
        const currentTimestamp = Date.now();
        const latency = currentTimestamp - messageTimestamp;
        
        message.reply(`Pong! 🏓\nKecepatan Respon: *${latency}ms*`);
    }
    
    if(msg === '.help') {
        if (isUserAdmin(message)) message.reply(HELP_MEMBER + HELP_ADMIN_ONLY + HELP_FOOTER);
        else message.reply(HELP_MEMBER + HELP_FOOTER);
    }

    // === FITUR LIST ADMIN BARU ===
    if(msg === '.admin') {
        const ADMIN_INFO = `👮‍♂️ *LIST ADMIN SEONE STORE* 👮‍♂️

*1. Zuka*
✦ 081361232066

*2. Linnn*
✦ 081260809729

*3. Genky*
✦ 082185523432

_Jika ada kendala mendesak, silakan hubungi admin di atas. Harap chat dengan sopan, no spam, no call!_ 😉`;
        message.reply(ADMIN_INFO);
    }

    if(msg === '.pay') {
        try {
            const media = MessageMedia.fromFilePath('./QRIS.png');
            await client.sendMessage(message.from, media, { caption: PAY_MSG });
        } catch (error) { message.reply('Mohon maaf, gambar QRIS sedang bermasalah.'); }
    }

    // --- FITUR VIEW (MEMBER) ---
    // GIG
    if(msg === '.gig') {
        let isClosed = false; let displayDate = 'Belum ada update'; let displayTime = '-';
        if (fs.existsSync('./database_update.json')) {
            try {
                const data = JSON.parse(fs.readFileSync('./database_update.json', 'utf8'));
                if (data.status === 'CLOSED') { isClosed = true; displayTime = data.time; } 
                else { displayDate = data.date; displayTime = data.time; }
            } catch (err) { }
        }
        if (isClosed) {
            message.reply(`🚫 *STOCK GIG KOSONG / TUTUP* 🚫\n\nMaaf ya, stock GIG lagi *HABIS* atau layanan *TUTUP*.\n⏰ *Closed sejak:* ${displayTime} WIB\n_Tunggu kabar selanjutnya ya 😙_`);
            return;
        }
        const TPL = `🛒 *GIG PRICELIST TERBARU* 🛒\n🗓️ *Update:* ${displayDate}\n🕛 *Pukul:* ${displayTime} WIB\n\nIni pricelist terbaru.\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*\n\n📝 *NOTE:*\nKirim bukti & tag admin ya 😙`;
        try {
            if (fs.existsSync('./pricelist.png')) await client.sendMessage(message.from, MessageMedia.fromFilePath('./pricelist.png'), { caption: TPL });
            else message.reply('⚠️ Admin belum upload Price List GIG.');
        } catch (error) { message.reply('Error sistem.'); }
    }

    // BOOSTER
    if(msg === '.booster') {
        let isClosed = false; let displayDate = 'Belum ada update'; let displayTime = '-';
        if (fs.existsSync('./database_booster.json')) {
            try {
                const data = JSON.parse(fs.readFileSync('./database_booster.json', 'utf8'));
                if (data.status === 'CLOSED') { isClosed = true; displayTime = data.time; } 
                else { displayDate = data.date; displayTime = data.time; }
            } catch (err) { }
        }
        if (isClosed) {
            message.reply(`🚫 *BOOSTER PENUH / CLOSED* 🚫\n\nSlot Booster *PENUH* atau *TUTUP*.\n⏰ *Closed sejak:* ${displayTime} WIB\n_Sabar ya guys!_ 🚀`);
            return;
        }
        const TPL = `🚀 *BOOSTER PRICELIST TERBARU*\n🗓️ *Update:* ${displayDate}\n🕛 *Pukul:* ${displayTime} WIB\n\nIni harga booster terbaru.\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*\n\n📝 *NOTE:*\nKirim bukti & tag admin ya 😙`;
        try {
            if (fs.existsSync('./pricelist_booster.png')) await client.sendMessage(message.from, MessageMedia.fromFilePath('./pricelist_booster.png'), { caption: TPL });
            else message.reply('⚠️ Admin belum upload Price List Booster.');
        } catch (error) { message.reply('Error sistem.'); }
    }

    // VILOG
    if(msg === '.vilog') {
        let isClosed = false; let displayDate = 'Belum ada update'; let displayTime = '-';
        if (fs.existsSync('./database_vilog.json')) {
            try {
                const data = JSON.parse(fs.readFileSync('./database_vilog.json', 'utf8'));
                if (data.status === 'CLOSED') { isClosed = true; displayTime = data.time; } 
                else { displayDate = data.date; displayTime = data.time; }
            } catch (err) { }
        }
        if (isClosed) {
            message.reply(`🚫 *VILOG CLOSED / ANTRIAN PENUH* 🚫\n\nLayanan Vilog sedang *TUTUP*.\n⏰ *Closed sejak:* ${displayTime} WIB\n_Mohon pengertiannya!_ 🔐`);
            return;
        }
        const TPL = `🔐 *VIA LOGIN PRICELIST* 🔐\n🗓️ *Update:* ${displayDate}\n🕛 *Pukul:* ${displayTime} WIB\n\n${VILOG_TNC}\n\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*\n\n📝 *NOTE:*\nKirim bukti & tag admin ya 😙`;
        try {
            if (fs.existsSync('./pricelist_vilog.png')) await client.sendMessage(message.from, MessageMedia.fromFilePath('./pricelist_vilog.png'), { caption: TPL });
            else message.reply('⚠️ Admin belum upload Price List Via Login.');
        } catch (error) { message.reply('Error sistem.'); }
    }

    // PTPT LIST (JOIN)
    if (msg.startsWith('.ptptlist')) {
        let robloxUser = message.body.slice(10).trim();
        if (!robloxUser) { message.reply(`⚠️ *Format Salah!*\n.ptptlist [Username Roblox]\nContoh: .ptptlist DragonSlayer99`); return; }
        if (!fs.existsSync('./database_ptpt.json')) { message.reply('⚠️ Belum ada sesi PTPT.'); return; }

        try {
            const raw = fs.readFileSync('./database_ptpt.json', 'utf8');
            let allSessions = JSON.parse(raw);
            const args = robloxUser.split(' ');
            let code = args[0].toUpperCase();
            let user = args.slice(1).join(' ');

            if (allSessions[code]) { if(!user) { message.reply(`⚠️ Masukkan username!\nContoh: .ptptlist ${code} ProPlayer`); return; } } 
            else { message.reply('⚠️ *Sesi tidak ditemukan / Format Salah!*\nHarap sertakan Kode Sesi.\nContoh: `.ptptlist 24H Username`'); return; }

            let session = allSessions[code];
            if (session.isClosed) { message.reply(`❌ *SESI DITUTUP* ❌\nSesi *${code}* sudah ditutup Admin.`); return; }
            if (session.participants.length >= 20) { message.reply(`❌ Slot sesi *${code}* penuh (20/20)!`); return; }
            if (session.participants.some(p => p.roblox.toLowerCase() === user.toLowerCase())) { message.reply(`⚠️ Username *${user}* sudah terdaftar!`); return; }

            const contact = await message.getContact();
            session.participants.push({ name: contact.pushname || contact.number, roblox: user, id: contact.id._serialized, isPaid: false });
            allSessions[code] = session;
            fs.writeFileSync('./database_ptpt.json', JSON.stringify(allSessions));

            let list = '';
            for (let i = 0; i < 20; i++) {
                let p = session.participants[i];
                list += `${i+1}. ${p ? `${p.name} / ${p.roblox}${p.isPaid ? ' ✅' : ''}` : ''}\n`;
            }

            const TPL = `📢 SESSION INFO (${code})\n• Jenis: ${session.sessionType}\n• Waktu: ${session.timeInfo}\n• Status: OPEN (${session.participants.length}/20)\n\n--------LIST MEMBER---------\nUSN Wa / USN rblox\n${list}\n*CARA JOIN???*\n_ketik : .ptptlist ${code} (username)_${PTPT_FOOTER}`;
            await message.reply(TPL);
        } catch (error) { console.log('Error ptptlist:', error); }
    }

    // PTPT UPDATE
    if(msg.startsWith('.ptptupdate')) {
        const args = message.body.slice(11).trim().split(' ');
        const code = args[0] ? args[0].toUpperCase() : null;
        if (!fs.existsSync('./database_ptpt.json')) { message.reply('⚠️ Belum ada sesi aktif.'); return; }

        try {
            const all = JSON.parse(fs.readFileSync('./database_ptpt.json', 'utf8'));
            const keys = Object.keys(all);
            if (keys.length === 0) { message.reply('⚠️ Database kosong.'); return; }

            if (code && all[code]) {
                let s = all[code];
                let list = '';
                for (let i = 0; i < 20; i++) {
                    let p = s.participants[i];
                    list += `${i+1}. ${p ? `${p.name} / ${p.roblox}${p.isPaid ? ' ✅' : ''}` : ''}\n`;
                }
                let status = s.isClosed ? 'CLOSED (DITUTUP ADMIN)' : (s.participants.length >= 20 ? 'FULL (20/20)' : `OPEN (${s.participants.length}/20)`);
                const TPL = `📢 SESSION INFO (${code})\n• Jenis: ${s.sessionType}\n• Waktu: ${s.timeInfo}\n• Status: ${status}\n\n--------LIST MEMBER---------\nUSN Wa / USN rblox\n${list}\n*CARA JOIN???*\n_ketik : .ptptlist ${code} (username)_${PTPT_FOOTER}`;
                
                if (fs.existsSync('./ptpt_image.png')) await client.sendMessage(message.from, MessageMedia.fromFilePath('./ptpt_image.png'), { caption: TPL });
                else await message.reply(TPL);
            } else {
                let txt = `📋 *DAFTAR SESI AKTIF:*\n\n`;
                keys.forEach(k => {
                    let s = all[k];
                    let lbl = s.isClosed ? "[CLOSED] ❌" : (s.participants.length >= 20 ? "[FULL]" : "[OPEN]");
                    txt += `🔹 *${k}* (${s.sessionType}) ${lbl}\n   📅 ${s.timeInfo}\n   👥 ${s.participants.length}/20\n   👉 .ptptlist ${k} [User]\n\n`;
                });
                await message.reply(txt);
            }
        } catch (error) { message.reply('❌ Gagal cek update.'); }
    }

    // --- AREA ADMIN ---
    if(msg === '.join on' || msg === '.join off' || msg === '.leave on' || msg === '.leave off' ||
       msg === '.gigupdate' || msg === '.gigreset' || msg === '.gigclose' || 
       msg === '.boosterupdate' || msg === '.boosterreset' || msg === '.boosterclose' || 
       msg === '.vilogupdate' || msg === '.vilogreset' || msg === '.vilogclose' ||
       msg.startsWith('.ptptreset') || msg.startsWith('.ptptopen') || msg.startsWith('.ptptclose') || msg.startsWith('.ptptset') || msg.startsWith('.ptptremove') || msg.startsWith('.ptptpaid') || msg === '.testgreet' || msg.startsWith('.p ')) {
        
        if (!isUserAdmin(message)) { message.reply('kamu bukan admin, jangan coba-coba ya dek yaaa😙'); return; }

        if (msg === '.join on') { BOT_SETTINGS.enableWelcome = true; saveSettings(); message.reply('✅ Auto Welcome: ON'); }
        if (msg === '.join off') { BOT_SETTINGS.enableWelcome = false; saveSettings(); message.reply('🚫 Auto Welcome: OFF'); }
        if (msg === '.leave on') { BOT_SETTINGS.enableGoodbye = true; saveSettings(); message.reply('✅ Auto Goodbye: ON'); }
        if (msg === '.leave off') { BOT_SETTINGS.enableGoodbye = false; saveSettings(); message.reply('🚫 Auto Goodbye: OFF'); }
        if (msg === '.testgreet') { const chat = await message.getChat(); const contact = await message.getContact(); await kirimSapaanDenganGambar(chat, contact); }

        // BROADCAST (.p) - SUDAH CEPAT
        if(msg.startsWith('.p ')) {
            const txt = message.body.slice(3).trim();
            if(!txt) { message.reply(`⚠️ *Format Salah!* .p [Pesan]`); return; }
            try {
                const chat = await message.getChat();
                const mentions = await getMentionsAll(chat); // Pakai helper cepat
                await chat.sendMessage(txt, { mentions: mentions });
            } catch (error) {}
        }

        // GIG ADMIN (UPDATE + TAG ALL)
        if(msg === '.gigupdate') {
             const chat = await message.getChat();
             const { date, time } = getWaktuIndonesia();
             fs.writeFileSync('./database_update.json', JSON.stringify({ date, time, status: 'OPEN' }));
             if (message.hasMedia) {
                const media = await message.downloadMedia();
                if(media) fs.writeFileSync('./pricelist.png', media.data, 'base64');
             }
             const mentions = await getMentionsAll(chat); // Pakai helper cepat
             const TPL = `📢 *GIG STOCK UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *READY STOCK!*\n\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*\n\n📝 *NOTE:*\nKirim bukti & tag admin ya 😙`;
             if(fs.existsSync('./pricelist.png')) await chat.sendMessage(MessageMedia.fromFilePath('./pricelist.png'), { caption: TPL, mentions: mentions });
             else await chat.sendMessage(TPL, { mentions: mentions });
             console.log(`[ADMIN] GIG Updated`);
        }
        if(msg === '.gigclose') {
            const { date, time } = getWaktuIndonesia();
            fs.writeFileSync('./database_update.json', JSON.stringify({ date, time, status: 'CLOSED' }));
            message.reply('⛔ *GIG CLOSED!*');
        }
        if(msg === '.gigreset') {
            try { if(fs.existsSync('./database_update.json')) fs.unlinkSync('./database_update.json');
            if(fs.existsSync('./pricelist.png')) fs.unlinkSync('./pricelist.png'); message.reply('✅ GIG Reset.'); } catch (e) { message.reply('❌ Gagal reset.'); }
        }

        // BOOSTER ADMIN (UPDATE + TAG ALL)
        if(msg === '.boosterupdate') {
             const chat = await message.getChat();
             const { date, time } = getWaktuIndonesia();
             fs.writeFileSync('./database_booster.json', JSON.stringify({ date, time, status: 'OPEN' }));
             if (message.hasMedia) {
                const media = await message.downloadMedia();
                if(media) fs.writeFileSync('./pricelist_booster.png', media.data, 'base64');
             }
             const mentions = await getMentionsAll(chat); // Pakai helper cepat
             const TPL = `📢 *BOOSTER UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *OPEN SLOT!*\n\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*\n\n📝 *NOTE:*\nKirim bukti & tag admin ya 😙`;
             if(fs.existsSync('./pricelist_booster.png')) await chat.sendMessage(MessageMedia.fromFilePath('./pricelist_booster.png'), { caption: TPL, mentions: mentions });
             else await chat.sendMessage(TPL, { mentions: mentions });
             console.log(`[ADMIN] Booster Updated`);
        }
        if(msg === '.boosterclose') {
            const { date, time } = getWaktuIndonesia();
            fs.writeFileSync('./database_booster.json', JSON.stringify({ date, time, status: 'CLOSED' }));
            message.reply('⛔ *BOOSTER CLOSED!*');
        }
        if(msg === '.boosterreset') {
            try { if(fs.existsSync('./database_booster.json')) fs.unlinkSync('./database_booster.json');
            if(fs.existsSync('./pricelist_booster.png')) fs.unlinkSync('./pricelist_booster.png'); message.reply('✅ Booster Reset.'); } catch (e) { message.reply('❌ Gagal reset.'); }
        }

        // VILOG ADMIN (UPDATE + TAG ALL)
        if(msg === '.vilogupdate') {
             const chat = await message.getChat();
             const { date, time } = getWaktuIndonesia();
             fs.writeFileSync('./database_vilog.json', JSON.stringify({ date, time, status: 'OPEN' }));
             if (message.hasMedia) {
                const media = await message.downloadMedia();
                if(media) fs.writeFileSync('./pricelist_vilog.png', media.data, 'base64');
             }
             const mentions = await getMentionsAll(chat); // Pakai helper cepat
             const TPL = `📢 *VIA LOGIN (JOKI) UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *OPEN ORDER!*\n\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*\n\n📝 *NOTE:*\nKirim bukti & tag admin ya 😙`;
             if(fs.existsSync('./pricelist_vilog.png')) await chat.sendMessage(MessageMedia.fromFilePath('./pricelist_vilog.png'), { caption: TPL, mentions: mentions });
             else await chat.sendMessage(TPL, { mentions: mentions });
             console.log(`[ADMIN] VILOG Updated`);
        }
        if(msg === '.vilogclose') {
            const { date, time } = getWaktuIndonesia();
            fs.writeFileSync('./database_vilog.json', JSON.stringify({ date, time, status: 'CLOSED' }));
            message.reply('⛔ *VILOG CLOSED!*');
        }
        if(msg === '.vilogreset') {
             try { if(fs.existsSync('./database_vilog.json')) fs.unlinkSync('./database_vilog.json');
             if(fs.existsSync('./pricelist_vilog.png')) fs.unlinkSync('./pricelist_vilog.png'); message.reply('✅ Vilog Reset.'); } catch (e) { message.reply('❌ Gagal reset.'); }
        }

        // PTPT ADMIN
        if(msg.startsWith('.ptptopen')) {
            const rawBody = message.body.slice(9).trim(); 
            const firstSpace = rawBody.indexOf(' ');
            if (firstSpace === -1) { message.reply(`⚠️ *FORMAT SALAH!* Lihat .help admin`); return; }
            const code = rawBody.substring(0, firstSpace).toUpperCase();
            const details = rawBody.substring(firstSpace + 1).split(',');
            if (details.length < 2) { message.reply('⚠️ *FORMAT SALAH!* Pisahkan [Jenis Sesi] dan [Info Waktu] dgn koma.'); return; }
            const type = details[0].trim(); const time = details[1].trim();

            message.reply(`⏳ Membuka sesi *${code}*...`);
            try {
                let all = {};
                if (fs.existsSync('./database_ptpt.json')) {
                    try { const f = fs.readFileSync('./database_ptpt.json', 'utf8'); const p = JSON.parse(f); if (!Array.isArray(p)) all = p; } catch(e) {}
                }
                all[code] = { sessionType: type, timeInfo: time, isClosed: false, participants: [] };
                fs.writeFileSync('./database_ptpt.json', JSON.stringify(all));
                if (message.hasMedia) { const m = await message.downloadMedia(); if(m) fs.writeFileSync('./ptpt_image.png', m.data, 'base64'); }

                const chat = await message.getChat();
                let list = ''; for (let i = 1; i <= 20; i++) list += `${i}.\n`;
                const TPL = `📢 SESSION INFO OPEN (${code})\n• Jenis: ${type}\n• Waktu: ${time}\n• Status: OPEN (0/20)\n\n--------LIST MEMBER---------\nUSN Wa / USN rblox\n${list}*CARA JOIN ???*\n_ketik : .ptptlist ${code} (username)_${PTPT_FOOTER}`;
                
                const mentions = await getMentionsAll(chat); // Pakai helper cepat
                if (fs.existsSync('./ptpt_image.png')) await chat.sendMessage(MessageMedia.fromFilePath('./ptpt_image.png'), { caption: TPL, mentions: mentions });
                else await chat.sendMessage(TPL, { mentions: mentions });
            } catch (error) { message.reply('❌ Gagal buka sesi.'); }
        }

        if(msg.startsWith('.ptptclose')) {
            const code = message.body.slice(10).trim().toUpperCase();
            if (!code) { message.reply('⚠️ Format: `.ptptclose [KODE]`'); return; }
            if (!fs.existsSync('./database_ptpt.json')) return;
            try {
                const raw = fs.readFileSync('./database_ptpt.json', 'utf8');
                let all = JSON.parse(raw);
                if (!all[code]) { message.reply(`❌ Sesi ${code} tak ditemukan.`); return; }
                all[code].isClosed = true;
                fs.writeFileSync('./database_ptpt.json', JSON.stringify(all));
                
                // Optional: Tag member di sesi itu saja, atau tag semua. Di sini kita tag semua untuk info.
                const chat = await message.getChat();
                const mentions = await getMentionsAll(chat); 
                await chat.sendMessage(`⛔ Sesi *${code}* berhasil DITUTUP. Member tidak bisa join lagi.`, { mentions: mentions });
            } catch (error) { message.reply('❌ Gagal tutup sesi.'); }
        }

        if(msg.startsWith('.ptptset')) {
            const rawBody = message.body.slice(8).trim(); const firstSpace = rawBody.indexOf(' ');
            if (firstSpace === -1) { message.reply('⚠️ Format: .ptptset [KODE] [Waktu Baru]'); return; }
            const code = rawBody.substring(0, firstSpace).toUpperCase(); const newTime = rawBody.substring(firstSpace + 1).trim();
            if (!fs.existsSync('./database_ptpt.json')) return;
            try {
                let all = JSON.parse(fs.readFileSync('./database_ptpt.json', 'utf8'));
                if (!all[code]) { message.reply(`❌ Sesi ${code} tak ditemukan.`); return; }
                all[code].timeInfo = newTime;
                fs.writeFileSync('./database_ptpt.json', JSON.stringify(all));
                message.reply(`✅ Info waktu *${code}* diupdate.`);
            } catch (error) { message.reply('❌ Gagal update.'); }
        }

        if(msg.startsWith('.ptptpaid')) {
            const rawBody = message.body.slice(9).trim(); const firstSpace = rawBody.indexOf(' ');
            if (firstSpace === -1) { message.reply('⚠️ Format: .ptptpaid [KODE] [No Urut]'); return; }
            const code = rawBody.substring(0, firstSpace).toUpperCase(); const numTxt = rawBody.substring(firstSpace + 1).trim();
            if (!fs.existsSync('./database_ptpt.json')) return;
            try {
                let all = JSON.parse(fs.readFileSync('./database_ptpt.json', 'utf8'));
                if (!all[code]) { message.reply(`❌ Sesi ${code} tak ditemukan.`); return; }
                const idxs = numTxt.split(',').map(i => parseInt(i.trim()) - 1);
                let s = all[code]; let updated = 0;
                idxs.forEach(i => { if (s.participants[i]) { s.participants[i].isPaid = true; updated++; } });
                if (updated === 0) { message.reply('⚠️ Tidak ada member valid.'); return; }
                all[code] = s; fs.writeFileSync('./database_ptpt.json', JSON.stringify(all));

                const chat = await message.getChat();
                let list = '';
                for (let i = 0; i < 20; i++) {
                    let p = s.participants[i];
                    list += `${i+1}. ${p ? `${p.name} / ${p.roblox}${p.isPaid ? ' ✅' : ''}` : ''}\n`;
                }
                const TPL = `📢 *PAYMENT CONFIRMED (${code})*\n• Jenis: ${s.sessionType}\n• Waktu: ${s.timeInfo}\n\n--------LIST MEMBER---------\nUSN Wa / USN rblox\n${list}_LUNAS!_ ✅\n*CARA JOIN ???*\n_ketik : .ptptlist ${code} (username)_${PTPT_FOOTER}`;
                
                const mentions = await getMentionsAll(chat); // Pakai helper cepat
                if (fs.existsSync('./ptpt_image.png')) await chat.sendMessage(MessageMedia.fromFilePath('./ptpt_image.png'), { caption: TPL, mentions: mentions });
                else await chat.sendMessage(TPL, { mentions: mentions });
            } catch (error) { console.log(error); message.reply('❌ Error.'); }
        }

        if(msg.startsWith('.ptptremove')) {
            const rawBody = message.body.slice(11).trim(); const firstSpace = rawBody.indexOf(' ');
            if (firstSpace === -1) { message.reply('⚠️ Format: .ptptremove [KODE] [No Urut]'); return; }
            const code = rawBody.substring(0, firstSpace).toUpperCase(); const idx = parseInt(rawBody.substring(firstSpace + 1).trim()) - 1;
            if (!fs.existsSync('./database_ptpt.json')) return;
            try {
                let all = JSON.parse(fs.readFileSync('./database_ptpt.json', 'utf8'));
                if (!all[code]) { message.reply(`❌ Sesi ${code} tak ditemukan.`); return; }
                let s = all[code];
                if (!s.participants[idx]) { message.reply('⚠️ Slot kosong.'); return; }
                const name = s.participants[idx].name;
                s.participants.splice(idx, 1);
                all[code] = s; fs.writeFileSync('./database_ptpt.json', JSON.stringify(all));
                message.reply(`✅ Hapus *${name}* dari ${code}.`);
            } catch (error) { message.reply('❌ Gagal hapus.'); }
        }

        if(msg.startsWith('.ptptreset')) {
            const code = message.body.slice(10).trim().toUpperCase();
            if (!code) { message.reply('⚠️ Format: .ptptreset all / [KODE]'); return; }
            try {
                if (code === 'ALL') {
                    if (fs.existsSync('./database_ptpt.json')) fs.unlinkSync('./database_ptpt.json');
                    if (fs.existsSync('./ptpt_image.png')) fs.unlinkSync('./ptpt_image.png');
                    message.reply('✅ PTPT Reset All.');
                } else {
                    if (!fs.existsSync('./database_ptpt.json')) { message.reply('⚠️ Database kosong.'); return; }
                    let all = JSON.parse(fs.readFileSync('./database_ptpt.json', 'utf8'));
                    if (all[code]) {
                        delete all[code];
                        if (Object.keys(all).length === 0) {
                            fs.unlinkSync('./database_ptpt.json'); if(fs.existsSync('./ptpt_image.png')) fs.unlinkSync('./ptpt_image.png');
                            message.reply(`✅ Sesi ${code} dihapus (db kosong).`);
                        } else {
                            fs.writeFileSync('./database_ptpt.json', JSON.stringify(all));
                            message.reply(`✅ Sesi ${code} dihapus.`);
                        }
                    } else { message.reply('❌ Sesi tak ditemukan.'); }
                }
            } catch (error) { message.reply('❌ Error reset.'); }
        }
    }
});

// === EVENT HANDLER (JOIN & LEAVE) ===
client.on('group_join', async (notification) => {
    if (notification.timestamp && notification.timestamp < BOT_START_TIME) return;
    if (!BOT_SETTINGS.enableWelcome) return;
    try {
        const chat = await notification.getChat();
        const contact = await client.getContactById(notification.recipientIds[0]); 
        await kirimSapaanDenganGambar(chat, contact);
    } catch (error) {}
});

client.on('group_leave', async (notification) => {
    if (notification.timestamp && notification.timestamp < BOT_START_TIME) return;
    if (!BOT_SETTINGS.enableGoodbye) return;
    try {
        const chat = await notification.getChat();
        const contact = await client.getContactById(notification.recipientIds[0]);
        const text = `@${contact.id.user} telah keluar dari grup, jangan lupa bawakan gorengan dan es teh manis se truk untuk member member ku jika kembali lagi 👋`;
        await chat.sendMessage(text, { mentions: [contact] });
    } catch (error) {}
});

client.initialize();