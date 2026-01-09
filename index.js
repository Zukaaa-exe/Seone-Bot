const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises; 
const fsSync = require('fs');      

// --- KONFIGURASI UTAMA ---
const BOT_START_TIME = Math.floor(Date.now() / 1000);
const COOLDOWN_IN_MS = 3000;
const cooldowns = new Map();

// --- DATABASE ---
let DB = {
    config: { welcome: true, goodbye: true },
    shop_status: {}, 
    ptpt_sessions: {},
    admins: [ 
        '273838558449745', '256723633852445', '189601952063685' 
    ]
};
const DB_FILE = './database_v2.json';

// --- LOAD/SAVE DB ---
async function loadDatabase() {
    if (fsSync.existsSync(DB_FILE)) {
        try {
            const raw = await fs.readFile(DB_FILE, 'utf8');
            DB = { ...DB, ...JSON.parse(raw) };
            console.log('✅ Database Loaded.');
        } catch (e) { saveDatabase(); }
    } else { saveDatabase(); }
}

async function saveDatabase() {
    try { await fs.writeFile(DB_FILE, JSON.stringify(DB, null, 2)); } catch (e) {}
}

// --- TEMPLATES ---
const SEONE_MSG_BODY = `*SeoneStore.ID* ✅Murah, Aman & Trusted 100%
⚡ Proses Cepat (1-10 Menit) | 💳 Bayar via : Qris
⏰ Open Daily: 05.00 - 23.00 WIB
⭐ Ketik *.help* untuk info lebih lengkap
*# ADMIN NEVER DM FIRST!*`;

const PAY_MSG = `*⚠️ PERINGATAN PEMBAYARAN:*
Pembayaran hanya valid jika dilakukan melalui *QRIS resmi* ini.
Transfer melalui DM/Link pribadi = *HANGUS/TIDAK SAH.*`;

const VILOG_TNC = `🔐 *INFORMASI VIA LOGIN (VILOG)* 🔐
1️⃣ *CARA:* Kirim User & Pass ke DM Admin.
2️⃣ *AMAN:* Data privasi terjaga.
3️⃣ *WAJIB:* Ganti password setelah selesai.
4️⃣ *NOTE:* JANGAN kirim data di GRUP!
# *INGAT! ADMIN NEVER DM FIRST!* 🚫`;

const HELP_MEMBER = `🛠️ *MENU MEMBER* 🛠️
✤ *.PAY* : Munculkan QRIS
✤ *.ADMIN* : List Admin
✤ *.GIG* | *.BOOSTER* | *.VILOG*
✤ *.PTPTLIST [KODE] [USER]* : Join Sesi
✤ *.PTPTUPDATE* : Cek Sesi Aktif
✤ *.HELP* | *.PING*`;

const HELP_ADMIN = `
---------ADMIN ONLY------------
✤ *.JOIN ON/OFF* | *.LEAVE ON/OFF*
✤ *.GIGUPDATE* | *.GIGRESET* | *.GIGCLOSE*
✤ *.BOOSTERUPDATE* | *.BOOSTERRESET* | *.BOOSTERCLOSE*
✤ *.VILOGUPDATE* | *.VILOGRESET* | *.VILOGCLOSE*
✤ *.PTPTOPEN* : Buka Sesi
✤ *.PTPTCLOSE* : Tutup Sesi
✤ *.PTPTSET* : Edit Jam
✤ *.PTPTPAID* : Confirm Bayar
✤ *.PTPTREMOVE* : Kick Member
✤ *.PTPTRESET* : Hapus Sesi
✤ *.P [teks]* : Broadcast`;

const HELP_FOOTER = `\n_SeoneStore.ID_ 🔥`;

// --- CLIENT SETUP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: [ '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process' ]
    }
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', async () => { console.log('BOT ONLINE!'); await loadDatabase(); });

// --- HELPER FUNCTIONS (YANG SUDAH DIPERBAIKI) ---

function isUserAdmin(msg) {
    let userID = (msg.author || msg.from).replace('@c.us', '').replace('@g.us', ''); 
    if(msg.from.includes('@g.us') && msg.author) userID = msg.author.split('@')[0];
    else userID = msg.from.split('@')[0];
    return DB.admins.includes(userID);
}

function getWaktu() {
    const now = new Date();
    return { 
        date: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }), 
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) 
    };
}

async function getMentionsAll(chat) {
    const mentions = await Promise.all(chat.participants.map(async (p) => {
        try { return await client.getContactById(p.id._serialized); } catch { return null; }
    }));
    return mentions.filter(c => c !== null);
}

// ⚠️ FIXED: Fungsi Kirim Pesan Universal (Bisa Gambar+Teks)
async function sendReply(chat, content, options = {}) {
    try {
        await chat.sendMessage(content, options);
    } catch (error) {
        console.log("Gagal kirim pesan, mencoba ulang...");
        try { await chat.sendMessage(content, options); } catch(e){}
    }
}

async function handleStatusView(msg, serviceName, imagePath) {
    const data = DB.shop_status[serviceName] || { status: 'OPEN', date: '-', time: '-' };
    const chat = await msg.getChat();

    if (data.status === 'CLOSED') {
        return msg.reply(`🚫 *${serviceName} CLOSED* 🚫\nMaaf layanan sedang tutup.\n⏰ *Sejak:* ${data.time} WIB`);
    }

    const TPL = `📢 *${serviceName} PRICELIST* 📢\n🗓️ *Update:* ${data.date} | 🕛 ${data.time} WIB\n\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*\n\n📝 *NOTE:*\nKirim bukti & tag admin ya 😙`;
    
    // Kirim Gambar + Caption (Jika ada gambar)
    if (fsSync.existsSync(imagePath)) {
        await sendReply(chat, MessageMedia.fromFilePath(imagePath), { caption: TPL, quotedMessageId: msg.id._serialized });
    } else {
        await msg.reply(`⚠️ Gambar Pricelist ${serviceName} belum diupload.\n\n` + TPL);
    }
}

async function handleStatusUpdate(msg, serviceName, imagePath, mode) {
    const { date, time } = getWaktu();
    const chat = await msg.getChat();

    if (mode === 'RESET') {
        delete DB.shop_status[serviceName];
        await saveDatabase();
        if(fsSync.existsSync(imagePath)) fsSync.unlinkSync(imagePath);
        return msg.reply(`✅ Data ${serviceName} berhasil di-RESET.`);
    }

    if (mode === 'CLOSE') {
        DB.shop_status[serviceName] = { status: 'CLOSED', date, time };
        await saveDatabase();
        return msg.reply(`⛔ ${serviceName} berhasil ditutup.`);
    }

    // MODE UPDATE
    DB.shop_status[serviceName] = { status: 'OPEN', date, time };
    await saveDatabase();

    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        if(media) await fs.writeFile(imagePath, media.data, 'base64');
    }

    const mentions = await getMentionsAll(chat);
    const TPL = `📢 *${serviceName} UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *READY/OPEN!*\n👇 *CARA PESAN:*\nTag admin & ketik *.pay*`;
    
    if(fsSync.existsSync(imagePath)) await sendReply(chat, MessageMedia.fromFilePath(imagePath), { caption: TPL, mentions });
    else await sendReply(chat, TPL, { mentions });
}

// === MAIN LOGIC ===
const ADMIN_COMMANDS = [
    '.join', '.leave', '.p', 
    '.gigupdate', '.gigreset', '.gigclose',
    '.boosterupdate', '.boosterreset', '.boosterclose',
    '.vilogupdate', '.vilogreset', '.vilogclose',
    '.ptptopen', '.ptptclose', '.ptptset', '.ptptpaid', '.ptptremove', '.ptptreset'
];

client.on('message', async (message) => {
    if (message.timestamp < BOT_START_TIME) return; 
    const msgBody = message.body.trim();
    const msg = msgBody.toLowerCase();
    const args = msgBody.split(/\s+/); // Split berdasarkan spasi
    const command = args[0].toLowerCase();

    // 1. CEK ADMIN ISENG
    if (ADMIN_COMMANDS.includes(command)) {
        if (!isUserAdmin(message)) return message.reply("kamu bukan admin jangan coba coba ya dek yaaa😙"); 
    }

    // 2. COOLDOWN
    if (msg.startsWith('.')) {
        if (cooldowns.has(message.from)) return;
        cooldowns.set(message.from, true);
        setTimeout(() => cooldowns.delete(message.from), COOLDOWN_IN_MS);
    } else { return; }

    const chat = await message.getChat();

    // --- COMMAND UMUM ---
    if (command === '.ping') return message.reply('Pong! 🏓');
    if (command === '.admin') return message.reply('*ADMIN:* Zuka, Linnn, Genky.');
    if (command === '.pay') {
        try {
            if(fsSync.existsSync('./QRIS.png')) await sendReply(chat, MessageMedia.fromFilePath('./QRIS.png'), { caption: PAY_MSG });
            else message.reply('⚠️ Gambar QRIS tidak ditemukan.');
        } catch(e) { message.reply('Error QRIS.'); }
    }
    
    if (command === '.help') {
        return message.reply(isUserAdmin(message) ? (HELP_MEMBER + HELP_ADMIN + HELP_FOOTER) : (HELP_MEMBER + HELP_FOOTER));
    }

    // --- FITUR SHOP VIEW ---
    if (command === '.gig') await handleStatusView(message, 'GIG', './pricelist.png');
    if (command === '.booster') await handleStatusView(message, 'BOOSTER', './pricelist_booster.png');
    if (command === '.vilog') await handleStatusView(message, 'VILOG', './pricelist_vilog.png');

    // --- PTPT MEMBER: LIST ---
    if (command === '.ptptlist') {
        // args[0]=.ptptlist, args[1]=KODE, args[2...]=Username
        const code = args[1] ? args[1].toUpperCase() : null;
        const user = args.slice(2).join(' ');

        if (!code || !user) return message.reply(`⚠️ *FORMAT SALAH!*\nContoh: .ptptlist A1 UcupGamer`);
        if (!DB.ptpt_sessions[code]) return message.reply(`❌ Sesi *${code}* tidak ditemukan.`);
        
        const session = DB.ptpt_sessions[code];
        if (session.is_closed) return message.reply('❌ Sesi sudah DITUTUP.');
        if (session.participants.length >= 20) return message.reply('❌ Sesi PENUH.');
        if (session.participants.some(p => p.roblox.toLowerCase() === user.toLowerCase())) return message.reply('⚠️ Kamu sudah terdaftar.');

        const contact = await message.getContact();
        session.participants.push({ name: contact.pushname || contact.number, roblox: user, is_paid: false });
        await saveDatabase();

        await sendPtptList(chat, code); // Tampilkan List
    }

    if (command === '.ptptupdate') {
        const code = args[1] ? args[1].toUpperCase() : null;
        if (code) {
             if (!DB.ptpt_sessions[code]) return message.reply(`❌ Sesi *${code}* tidak ditemukan.`);
             await sendPtptList(chat, code);
        } else {
             // Tampilkan semua sesi
             const keys = Object.keys(DB.ptpt_sessions);
             if (keys.length === 0) return message.reply('⚠️ Belum ada sesi aktif.');
             let txt = `📋 *DAFTAR SESI:*\n`;
             keys.forEach(k => {
                 const s = DB.ptpt_sessions[k];
                 txt += `🔹 *${k}* (${s.type}) - ${s.participants.length}/20 ${s.is_closed ? '[CLOSE]' : '[OPEN]'}\n`;
             });
             message.reply(txt + '\n_Ketik .ptptupdate [KODE] untuk detail._');
        }
    }

    // ================= ADMIN AREA =================
    if (isUserAdmin(message)) {
        
        // --- CONFIG GROUP ---
        if (command === '.join') { DB.config.welcome = (args[1] === 'on'); saveDatabase(); message.reply(`Auto Welcome: ${args[1]}`); }
        if (command === '.leave') { DB.config.goodbye = (args[1] === 'on'); saveDatabase(); message.reply(`Auto Goodbye: ${args[1]}`); }
        if (command === '.p') {
            const txt = msgBody.slice(3);
            const mentions = await getMentionsAll(chat);
            await sendReply(chat, txt, { mentions });
        }

        // --- SHOP UPDATE ---
        if (command === '.gigupdate') await handleStatusUpdate(message, 'GIG', './pricelist.png', 'UPDATE');
        if (command === '.gigclose') await handleStatusUpdate(message, 'GIG', null, 'CLOSE');
        if (command === '.gigreset') await handleStatusUpdate(message, 'GIG', './pricelist.png', 'RESET');
        
        if (command === '.boosterupdate') await handleStatusUpdate(message, 'BOOSTER', './pricelist_booster.png', 'UPDATE');
        if (command === '.boosterclose') await handleStatusUpdate(message, 'BOOSTER', null, 'CLOSE');
        if (command === '.boosterreset') await handleStatusUpdate(message, 'BOOSTER', './pricelist_booster.png', 'RESET');
        
        if (command === '.vilogupdate') await handleStatusUpdate(message, 'VILOG', './pricelist_vilog.png', 'UPDATE');
        if (command === '.vilogclose') await handleStatusUpdate(message, 'VILOG', null, 'CLOSE');
        if (command === '.vilogreset') await handleStatusUpdate(message, 'VILOG', './pricelist_vilog.png', 'RESET');

        // --- PTPT ADMIN ---
        
        // 1. OPEN (TAMBAH HARGA)
        if (command === '.ptptopen') {
            // Format: .ptptopen KODE JENIS, JAM, HARGA
            const rawBody = msgBody.slice(9).trim(); // Hapus ".ptptopen"
            const firstSpace = rawBody.indexOf(' ');
            
            if (firstSpace === -1) return message.reply(`⚠️ *FORMAT SALAH!*\nContoh: .ptptopen A1 BloxFruit, 19.00 WIB, 50K`);
            
            const code = rawBody.substring(0, firstSpace).toUpperCase();
            const details = rawBody.substring(firstSpace + 1).split(',').map(s => s.trim());
            
            // Cek kelengkapan (Minimal Jenis & Waktu)
            if (details.length < 2) return message.reply(`⚠️ *DATA KURANG!*\nMasukkan Jenis, Waktu, dan Harga (Opsional).`);

            const type = details[0];
            const time = details[1];
            const price = details[2] || "Gratis/Tanya Admin"; // Harga default jika tidak diisi

            DB.ptpt_sessions[code] = { type, time, price, is_closed: false, participants: [] };
            await saveDatabase();

            if (message.hasMedia) {
                const m = await message.downloadMedia();
                if(m) await fs.writeFile('./ptpt_image.png', m.data, 'base64');
            }
            
            // Auto Update List
            await sendPtptList(chat, code, true); // true = pake tag all
        }

        // 2. CLOSE
        if (command === '.ptptclose') {
            const code = args[1] ? args[1].toUpperCase() : null;
            if (!code) return message.reply('⚠️ *FORMAT SALAH!*\nContoh: .ptptclose A1');
            if (!DB.ptpt_sessions[code]) return message.reply(`❌ Sesi ${code} tidak ditemukan.`);
            
            DB.ptpt_sessions[code].is_closed = true;
            await saveDatabase();
            message.reply(`✅ Sesi ${code} DITUTUP.`);
        }

        // 3. RESET
        if (command === '.ptptreset') {
            const code = args[1] ? args[1].toUpperCase() : null;
            if (!code) return message.reply('⚠️ *FORMAT SALAH!*\nContoh: .ptptreset A1\nAtau: .ptptreset ALL');

            if (code === 'ALL') {
                DB.ptpt_sessions = {};
                await saveDatabase();
                message.reply('✅ SEMUA Sesi dihapus.');
            } else {
                if (!DB.ptpt_sessions[code]) return message.reply(`❌ Sesi ${code} tidak ditemukan.`);
                delete DB.ptpt_sessions[code];
                await saveDatabase();
                message.reply(`✅ Sesi ${code} dihapus.`);
            }
        }

        // 4. SET (EDIT WAKTU)
        if (command === '.ptptset') {
            // .ptptset A1 20.00 WIB
            const code = args[1] ? args[1].toUpperCase() : null;
            const newTime = args.slice(2).join(' ');
            
            if (!code || !newTime) return message.reply('⚠️ *FORMAT SALAH!*\nContoh: .ptptset A1 21.00 WIB');
            if (!DB.ptpt_sessions[code]) return message.reply(`❌ Sesi ${code} tidak ditemukan.`);

            DB.ptpt_sessions[code].time = newTime;
            await saveDatabase();
            
            // Kirim notif text saja biar ringkas
            message.reply(`✅ Waktu sesi ${code} diubah jadi: ${newTime}`);
        }

        // 5. REMOVE
        if (command === '.ptptremove') {
            const code = args[1] ? args[1].toUpperCase() : null;
            const num = parseInt(args[2]);

            if (!code || isNaN(num)) return message.reply('⚠️ *FORMAT SALAH!*\nContoh: .ptptremove A1 1 (Hapus no urut 1)');
            if (!DB.ptpt_sessions[code]) return message.reply(`❌ Sesi ${code} tidak ditemukan.`);
            
            const idx = num - 1;
            if (!DB.ptpt_sessions[code].participants[idx]) return message.reply('❌ Nomor urut salah/kosong.');

            DB.ptpt_sessions[code].participants.splice(idx, 1);
            await saveDatabase();
            
            await sendPtptList(chat, code);
        }

        // 6. PAID (CONFIRM)
        if (command === '.ptptpaid') {
            // .ptptpaid A1 1 2 5
            const code = args[1] ? args[1].toUpperCase() : null;
            if (!code) return message.reply('⚠️ *FORMAT SALAH!*\nContoh: .ptptpaid A1 1 2 3');
            if (!DB.ptpt_sessions[code]) return message.reply(`❌ Sesi ${code} tidak ditemukan.`);

            const nums = args.slice(2).map(n => parseInt(n) - 1).filter(n => !isNaN(n));
            if (nums.length === 0) return message.reply('⚠️ Masukkan nomor urut member.');

            let count = 0;
            nums.forEach(i => {
                if (DB.ptpt_sessions[code].participants[i]) {
                    DB.ptpt_sessions[code].participants[i].is_paid = true;
                    count++;
                }
            });

            if (count > 0) {
                await saveDatabase();
                await sendPtptList(chat, code);
            } else {
                message.reply('❌ Tidak ada member yang diupdate (Nomor salah).');
            }
        }
    }
});

// --- HELPER KHUSUS PTPT DISPLAY ---
async function sendPtptList(chat, code, withTag = false) {
    const session = DB.ptpt_sessions[code];
    if (!session) return;

    let list = '';
    for (let i = 0; i < 20; i++) {
        let p = session.participants[i];
        list += `${i+1}. ${p ? `${p.name} / ${p.roblox}${p.is_paid ? ' ✅' : ''}` : ''}\n`;
    }

    const statusStr = session.is_closed ? '⛔ CLOSED' : (session.participants.length >= 20 ? '🔴 FULL' : `🟢 OPEN (${session.participants.length}/20)`);
    const priceStr = session.price ? `\n💰 *Harga:* ${session.price}` : ''; // Menampilkan Harga

    const caption = 
`📢 *SESSION INFO (${code})*
🎮 *Game:* ${session.type}
⏰ *Jam:* ${session.time} ${priceStr}
📊 *Status:* ${statusStr}

-------- LIST MEMBER ---------
*Nama WA / User Roblox*
${list}
*CARA JOIN?*
Ketik: *.ptptlist ${code} UsernameRoblox*
_Contoh: .ptptlist ${code} KingGamer_

-------------------------------
💸 *CARA BAYAR:* Ketik *.pay*
📸 *BUKTI:* Kirim SS & Tag Admin!`;

    const options = { caption };
    if (withTag) options.mentions = await getMentionsAll(chat);

    if (fsSync.existsSync('./ptpt_image.png')) {
        await sendReply(chat, MessageMedia.fromFilePath('./ptpt_image.png'), options);
    } else {
        await sendReply(chat, caption, options);
    }
}

// --- EVENT JOIN/LEAVE ---
async function kirimSapaanDenganGambar(chatTarget, contactToTag) {
    let picUrl = null;
    try { picUrl = await chatTarget.getProfilePicUrl(); } catch (err) {}
    if (!picUrl) { try { picUrl = await client.getProfilePicUrl(client.info.wid._serialized); } catch (err) {} }

    const caption = `Yo @${contactToTag.id.user}! Welcome to \n` + SEONE_MSG_BODY;
    const options = { caption, mentions: [contactToTag] };

    if (picUrl) {
        try { await sendReply(chatTarget, await MessageMedia.fromUrl(picUrl), options); } 
        catch { await sendReply(chatTarget, caption, options); }
    } else {
        await sendReply(chatTarget, caption, options);
    }
}

client.on('group_join', async (n) => {
    if (n.timestamp < BOT_START_TIME || !DB.config.welcome) return;
    try { await kirimSapaanDenganGambar(await n.getChat(), await client.getContactById(n.recipientIds[0])); } catch(e){}
});

client.on('group_leave', async (n) => {
    if (n.timestamp < BOT_START_TIME || !DB.config.goodbye) return;
    try {
        const c = await client.getContactById(n.recipientIds[0]);
        await sendReply(await n.getChat(), `@${c.id.user} keluar. Jangan lupa bawa gorengan kalau balik! 👋`, {mentions:[c]});
    } catch(e){}
});

client.initialize();