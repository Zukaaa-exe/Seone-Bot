const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs'); 

// --- PENGATURAN WAKTU & SPAM ---
const BOT_START_TIME = Math.floor(Date.now() / 1000);

let lastCommandTime = 0; 
const COOLDOWN_IN_MS = 3000; // Delay 3 Detik

// --- KONFIGURASI ADMIN ---
const LIST_ADMIN = [ 
    '273838558449745',    // ID User Linnn
    '256723633852445',    // ID User Genky
    '189601952063685'     // ID User Hayyu
];

// --- DATABASE PESAN ---
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

// --- SYARAT & KETENTUAN VILOG (MEMBER) ---
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
✤ *.GIG*
✤ *.BOOSTER*
✤ *.VILOG* (Via Login + TnC) ✅
✤ *.PTPTLIST [KODE] [USN]* (Daftar Sesi)
✤ *.PTPTUPDATE* (Cek Daftar Sesi Aktif)
✤ *.HELP*
✤ *.PING*`;

const HELP_ADMIN_ONLY = `
---------ADMIN ONLY------------
✤ *.GIGUPDATE* 
✤ *.GIGRESET*
✤ *.BOOSTERUPDATE* 
✤ *.BOOSTERRESET*
✤ *.VILOGUPDATE* 
✤ *.VILOGRESET*
✤ *.PTPTOPEN [KODE] [KET]*
✤ *.PTPTSET [KODE] [KET]*
✤ *.PTPTPAID [KODE] [NOMOR]*
✤ *.PTPTREMOVE [KODE] [NOMOR]*
✤ *.PTPTRESET [KODE]* / *.PTPTRESET ALL*
✤ *.P (teks)*`;

const HELP_FOOTER = `
_SeoneStore.ID - Happy Shopping!_ 🔥`;


// Settingan Bot (WAJIB TERMUX)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('Scan QR Code di bawah ini pake WA kamu:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Mantap! Bot sudah ONLINE dan siap tempur!');
});

// --- FUNGSI BANTUAN (HELPER) ---

function isUserAdmin(msg) {
    let userID = null;
    if (msg.from.includes('@g.us')) {
        if (msg.author) {
            userID = msg.author.split('@')[0].split(':')[0];
        }
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
    if (message.timestamp < BOT_START_TIME) return; 

    const msg = message.body.toLowerCase();

    // COOLDOWN LOGIC
    if (msg.startsWith('.')) {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastCommandTime;
        if (timeDiff < COOLDOWN_IN_MS) {
            message.reply('uupppssss, seseorang baru saja menggunakan command. tunggu 3detik lagi');
            return; 
        }
        lastCommandTime = currentTime;
    } else {
        return;
    }

    // --- COMMAND MEMBER ---
    if(msg === '.ping') message.reply('pong');
    
    if(msg === '.help') {
        console.log(`[LOG] User ${message.from} request .help`);
        if (isUserAdmin(message)) {
            message.reply(HELP_MEMBER + HELP_ADMIN_ONLY + HELP_FOOTER);
        } else {
            message.reply(HELP_MEMBER + HELP_FOOTER);
        }
    }

    if(msg === '.pay') {
        try {
            const media = MessageMedia.fromFilePath('./QRIS.png');
            await client.sendMessage(message.from, media, { caption: PAY_MSG });
        } catch (error) { message.reply('Mohon maaf, gambar QRIS sedang bermasalah.'); }
    }

    // FITUR GIG & BOOSTER & VILOG
    if(msg === '.gig') {
        let displayDate = 'Belum ada update';
        let displayTime = '-';
        if (fs.existsSync('./database_update.json')) {
            try {
                const rawData = fs.readFileSync('./database_update.json', 'utf8');
                const lastUpdate = JSON.parse(rawData);
                displayDate = lastUpdate.date;
                displayTime = lastUpdate.time;
            } catch (err) { }
        }
        const GIG_TEMPLATE = `🛒 *GIG PRICELIST TERBARU* 🛒
🗓️ *Tanggal Update:* ${displayDate}
🕛 *Pukul:* ${displayTime} WIB

Ini gig pricelist terbaru sesuai tanggal dan waktu update admin.
👇 *CARA PESAN:*
Tag admin yang bersangkutan dan ketik *.pay* untuk menampilkan QRIS payment yaaa.`;

        try {
            if (fs.existsSync('./pricelist.png')) {
                const media = MessageMedia.fromFilePath('./pricelist.png');
                await client.sendMessage(message.from, media, { caption: GIG_TEMPLATE });
            } else { message.reply('⚠️ Admin belum upload Price List GIG.'); }
        } catch (error) { message.reply('Error sistem.'); }
    }

    if(msg === '.booster') {
        let displayDate = 'Belum ada update';
        let displayTime = '-';
        if (fs.existsSync('./database_booster.json')) {
            try {
                const rawData = fs.readFileSync('./database_booster.json', 'utf8');
                const lastUpdate = JSON.parse(rawData);
                displayDate = lastUpdate.date;
                displayTime = lastUpdate.time;
            } catch (err) { }
        }
        const BOOSTER_TEMPLATE = `🚀 *BOOSTER PRICELIST TERBARU*
🗓️ *Tanggal Update:* ${displayDate}
🕛 *Pukul:* ${displayTime} WIB

Ini harga booster terbaru sesuai update admin.
👇 *CARA PESAN:*
Tag admin yang bersangkutan dan ketik *.pay* untuk menampilkan QRIS payment yaaa.`;

        try {
            if (fs.existsSync('./pricelist_booster.png')) {
                const media = MessageMedia.fromFilePath('./pricelist_booster.png');
                await client.sendMessage(message.from, media, { caption: BOOSTER_TEMPLATE });
            } else { message.reply('⚠️ Admin belum upload Price List Booster.'); }
        } catch (error) { message.reply('Error sistem.'); }
    }

    // === FITUR VILOG (MEMBER) ===
    if(msg === '.vilog') {
        let displayDate = 'Belum ada update';
        let displayTime = '-';
        if (fs.existsSync('./database_vilog.json')) {
            try {
                const rawData = fs.readFileSync('./database_vilog.json', 'utf8');
                const lastUpdate = JSON.parse(rawData);
                displayDate = lastUpdate.date;
                displayTime = lastUpdate.time;
            } catch (err) { }
        }
        
        const VILOG_TEMPLATE = `🔐 *VIA LOGIN PRICELIST* 🔐
🗓️ *Tanggal Update:* ${displayDate}
🕛 *Pukul:* ${displayTime} WIB

${VILOG_TNC}

👇 *CARA PESAN:*
Tag admin yang bersangkutan dan ketik *.pay* untuk menampilkan QRIS payment.`;

        try {
            if (fs.existsSync('./pricelist_vilog.png')) {
                const media = MessageMedia.fromFilePath('./pricelist_vilog.png');
                await client.sendMessage(message.from, media, { caption: VILOG_TEMPLATE });
            } else { message.reply('⚠️ Admin belum upload Price List Via Login.'); }
        } catch (error) { message.reply('Error sistem.'); }
    }

    // =========================================================
    // === SISTEM PTPT BARU (MULTI-SESSION / BANYAK KAMAR) ===
    // =========================================================

    // === 1. FITUR PTPT LIST (MEMBER) ===
    if (msg.startsWith('.ptptlist')) {
        // Format Baru: .ptptlist [KODE] [USERNAME]
        const args = message.body.slice(9).trim().split(' ');
        const sessionCode = args[0] ? args[0].toUpperCase() : null;
        const robloxUser = args.slice(1).join(' '); // Ambil sisanya sebagai username

        // 1. Cek Format Input
        if (!sessionCode || !robloxUser) {
            message.reply(`⚠️ *Format Salah!* Harap masukkan Kode Sesi & Username.

📋 *Format:*
.ptptlist [KODE] [Username Roblox]

✅ *Contoh:*
.ptptlist 24H DragonSlayer
.ptptlist 9H ProPlayer123

_Cek kode sesi yang aktif dengan ketik .ptptupdate_`);
            return;
        }

        if (!fs.existsSync('./database_ptpt.json')) {
            message.reply('⚠️ Belum ada sesi PTPT apapun yang aktif.');
            return;
        }

        try {
            const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
            let allSessions = JSON.parse(rawData);

            // 2. Cek Apakah Sesi Ada?
            if (!allSessions[sessionCode]) {
                message.reply(`❌ Sesi dengan kode *${sessionCode}* tidak ditemukan!\nKetik *.ptptupdate* untuk melihat daftar sesi aktif.`);
                return;
            }

            let currentSession = allSessions[sessionCode];

            // 3. Cek Slot Penuh
            if (currentSession.participants.length >= 20) {
                message.reply(`❌ Yah, slot sesi *${sessionCode}* sudah penuh (20/20)!`);
                return;
            }

            // 4. SATPAM USERNAME ROBLOX (Per Sesi)
            const isRobloxTaken = currentSession.participants.some(p => p.roblox.toLowerCase() === robloxUser.toLowerCase());

            if (isRobloxTaken) {
                message.reply(`⚠️ Username Roblox *${robloxUser}* sudah terdaftar di sesi *${sessionCode}*!`);
                return;
            }

            const contact = await message.getContact();
            const waName = contact.pushname || contact.number;
            const waNumber = contact.id._serialized;

            // 5. Masukkan Data ke Sesi Tersebut
            currentSession.participants.push({
                name: waName,
                roblox: robloxUser,
                id: waNumber,
                isPaid: false 
            });

            // Simpan Balik ke Database Utama
            allSessions[sessionCode] = currentSession;
            fs.writeFileSync('./database_ptpt.json', JSON.stringify(allSessions));
            console.log(`[LOG] User joined Session ${sessionCode}: ${robloxUser}`);

            // 6. Output List (Khusus Sesi Ini)
            let listText = '';
            for (let i = 0; i < 20; i++) {
                const num = i + 1;
                if (currentSession.participants[i]) {
                    const paidIcon = currentSession.participants[i].isPaid ? ' ✅' : '';
                    listText += `${num}. ${currentSession.participants[i].name} / ${currentSession.participants[i].roblox}${paidIcon}\n`;
                } else {
                    listText += `${num}.\n`;
                }
            }

            const FINAL_TEMPLATE = `📢 SESSION INFO (${sessionCode})
• Jenis: ${currentSession.sessionType}
• Waktu: ${currentSession.timeInfo}
• Status: OPEN (${currentSession.participants.length}/20)

--------LIST MEMBER---------
USN Wa / USN rblox
${listText}
_List otomatis terupdate_ ✅`;

            await message.reply(FINAL_TEMPLATE);

        } catch (error) {
            console.log('Error ptptlist:', error);
            message.reply('Gagal mendaftar list.');
        }
    }

    // === 2. FITUR PTPT UPDATE (VIEW INFO) ===
    if(msg.startsWith('.ptptupdate')) {
        // Bisa .ptptupdate (Semua) atau .ptptupdate [KODE]
        const args = message.body.slice(11).trim().split(' ');
        const targetCode = args[0] ? args[0].toUpperCase() : null;

        if (!fs.existsSync('./database_ptpt.json')) {
            message.reply('⚠️ Belum ada sesi aktif.');
            return;
        }

        try {
            const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
            const allSessions = JSON.parse(rawData);
            const sessionKeys = Object.keys(allSessions);

            if (sessionKeys.length === 0) {
                message.reply('⚠️ Database kosong (Belum ada sesi).');
                return;
            }

            // A. Jika user mengetik KODE SPESIFIK -> Tampilkan List Detail
            if (targetCode && allSessions[targetCode]) {
                let currentSession = allSessions[targetCode];
                let listText = '';
                for (let i = 0; i < 20; i++) {
                    const num = i + 1;
                    if (currentSession.participants[i]) {
                        const paidIcon = currentSession.participants[i].isPaid ? ' ✅' : '';
                        listText += `${num}. ${currentSession.participants[i].name} / ${currentSession.participants[i].roblox}${paidIcon}\n`;
                    } else {
                        listText += `${num}.\n`;
                    }
                }

                const DETAIL_TEMPLATE = `📢 SESSION INFO (${targetCode})
• Jenis: ${currentSession.sessionType}
• Waktu: ${currentSession.timeInfo}
• Status: OPEN (${currentSession.participants.length}/20)

--------LIST MEMBER---------
USN Wa / USN rblox
${listText}
_List otomatis terupdate_ ✅`;
                
                // Kirim Gambar (Jika ada gambar spesifik untuk sesi, bisa dikembangkan. Skrg pakai default ptpt_image)
                if (fs.existsSync('./ptpt_image.png')) {
                    await client.sendMessage(message.from, MessageMedia.fromFilePath('./ptpt_image.png'), { caption: DETAIL_TEMPLATE });
                } else {
                    await message.reply(DETAIL_TEMPLATE);
                }

            } else {
                // B. Jika user HANYA mengetik .ptptupdate -> Tampilkan Ringkasan Semua Sesi
                let summaryText = `📋 *DAFTAR SESI AKTIF SAAT INI:*\n\n`;
                
                sessionKeys.forEach(code => {
                    const s = allSessions[code];
                    summaryText += `🔹 *KODE: ${code}* (${s.sessionType})\n`;
                    summaryText += `   📅 Waktu: ${s.timeInfo}\n`;
                    summaryText += `   👥 Slot: ${s.participants.length}/20 Terisi\n`;
                    summaryText += `   👉 Ketik: *.ptptlist ${code} [Username]*\n\n`;
                });

                summaryText += `_Ingin lihat list lengkap? Ketik .ptptupdate [KODE]_`;
                await message.reply(summaryText);
            }

        } catch (error) {
            console.log('Error PTPT Update:', error);
            message.reply('❌ Gagal menampilkan info sesi.');
        }
    }

    // --- AREA KHUSUS ADMIN ---
    if(msg === '.gigupdate' || msg === '.gigreset' || msg === '.boosterupdate' || msg === '.boosterreset' || msg === '.vilogupdate' || msg === '.vilogreset' || msg.startsWith('.ptptreset') || msg.startsWith('.ptptopen') || msg.startsWith('.ptptset') || msg.startsWith('.ptptremove') || msg.startsWith('.ptptpaid') || msg === '.testgreet' || msg.startsWith('.p ')) {
        
        if (!isUserAdmin(message)) {
            message.reply('kamu bukan admin, jangan coba-coba ya dek yaaa😙'); 
            return; 
        }

        if(msg === '.testgreet') {
            const chat = await message.getChat();
            const contact = await message.getContact();
            await kirimSapaanDenganGambar(chat, contact);
        }

        if(msg.startsWith('.p ')) {
            const textToSend = message.body.slice(3).trim();
            if(!textToSend) { message.reply(`⚠️ *Format Salah!*\n\n📝 *Format:*\n.p [Pesan Kamu]`); return; }
            try {
                const chat = await message.getChat();
                let mentions = [];
                for(let participant of chat.participants) {
                    try {
                        const contact = await client.getContactById(participant.id._serialized);
                        mentions.push(contact);
                    } catch (err) {}
                }
                await chat.sendMessage(textToSend, { mentions: mentions });
            } catch (error) {}
        }

        // --- GIG & BOOSTER & VILOG (ADMIN) ---
        // (Kode sama seperti V43, dipertahankan)
        if(msg === '.gigupdate') {
             const chat = await message.getChat();
             const { date, time } = getWaktuIndonesia();
             fs.writeFileSync('./database_update.json', JSON.stringify({ date, time }));
             if (message.hasMedia) {
                const media = await message.downloadMedia();
                if(media) fs.writeFileSync('./pricelist.png', media.data, 'base64');
             }
             let mentions = [];
             for(let p of chat.participants) { try{mentions.push(await client.getContactById(p.id._serialized))}catch(e){} }
             const TPL = `📢 *GIG STOCK UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *READY STOCK!*\n\n👇 *CARA PESAN:*\nTag admin yang bersangkutan dan ketik *.pay*`;
             if(fs.existsSync('./pricelist.png')) { await chat.sendMessage(MessageMedia.fromFilePath('./pricelist.png'), { caption: TPL, mentions: mentions }); } 
             else { await chat.sendMessage(TPL, { mentions: mentions }); }
        }
        if(msg === '.gigreset') {
            if(fs.existsSync('./database_update.json')) fs.unlinkSync('./database_update.json');
            if(fs.existsSync('./pricelist.png')) fs.unlinkSync('./pricelist.png');
            message.reply('✅ Data GIG direset.');
        }
        if(msg === '.boosterupdate') {
             const chat = await message.getChat();
             const { date, time } = getWaktuIndonesia();
             fs.writeFileSync('./database_booster.json', JSON.stringify({ date, time }));
             if (message.hasMedia) {
                const media = await message.downloadMedia();
                if(media) fs.writeFileSync('./pricelist_booster.png', media.data, 'base64');
             }
             let mentions = [];
             for(let p of chat.participants) { try{mentions.push(await client.getContactById(p.id._serialized))}catch(e){} }
             const TPL = `📢 *BOOSTER UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *OPEN SLOT!*\n\n👇 *CARA PESAN:*\nTag admin yang bersangkutan dan ketik *.pay*`;
             if(fs.existsSync('./pricelist_booster.png')) { await chat.sendMessage(MessageMedia.fromFilePath('./pricelist_booster.png'), { caption: TPL, mentions: mentions }); } 
             else { await chat.sendMessage(TPL, { mentions: mentions }); }
        }
        if(msg === '.boosterreset') {
            if(fs.existsSync('./database_booster.json')) fs.unlinkSync('./database_booster.json');
            if(fs.existsSync('./pricelist_booster.png')) fs.unlinkSync('./pricelist_booster.png');
            message.reply('✅ Data Booster direset.');
        }
        if(msg === '.vilogupdate') {
             const chat = await message.getChat();
             const { date, time } = getWaktuIndonesia();
             fs.writeFileSync('./database_vilog.json', JSON.stringify({ date, time }));
             if (message.hasMedia) {
                const media = await message.downloadMedia();
                if(media) fs.writeFileSync('./pricelist_vilog.png', media.data, 'base64');
             }
             let mentions = [];
             for(let p of chat.participants) { try{mentions.push(await client.getContactById(p.id._serialized))}catch(e){} }
             const TPL = `📢 *VIA LOGIN (JOKI) UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *OPEN ORDER!*\n\n👇 *CARA PESAN:*\nTag admin yang bersangkutan dan ketik *.pay*`;
             if(fs.existsSync('./pricelist_vilog.png')) { await chat.sendMessage(MessageMedia.fromFilePath('./pricelist_vilog.png'), { caption: TPL, mentions: mentions }); } 
             else { await chat.sendMessage(TPL, { mentions: mentions }); }
        }
        if(msg === '.vilogreset') {
            if(fs.existsSync('./database_vilog.json')) fs.unlinkSync('./database_vilog.json');
            if(fs.existsSync('./pricelist_vilog.png')) fs.unlinkSync('./pricelist_vilog.png');
            message.reply('✅ Data Vilog direset.');
        }

        // =========================================================
        // === ADMIN PTPT MULTI-SESSION MANAGEMENT ===
        // =========================================================

        // 1. OPEN SESI
        if(msg.startsWith('.ptptopen')) {
            // Format: .ptptopen [KODE] [Jenis], [WaktuLengkap]
            // Contoh: .ptptopen 24H 12Jam, 30 Des 20.00 - 08.00
            
            const rawBody = message.body.slice(9).trim(); // Hapus command
            const firstSpace = rawBody.indexOf(' ');
            
            if (firstSpace === -1) {
                message.reply(`⚠️ *Format Salah!* Kode sesi belum dimasukkan.

📝 *Format:*
.ptptopen [KODE] [Jenis], [Info Waktu]

✅ *Contoh:*
.ptptopen 24H 12Jam, 30 Des 20.00-08.00
.ptptopen 9H 6Jam, TBA`);
                return;
            }

            const sessionCode = rawBody.substring(0, firstSpace).toUpperCase();
            const details = rawBody.substring(firstSpace + 1).split(',');

            if (details.length < 2) {
                message.reply('⚠️ Detail sesi kurang lengkap (Pisahkan Jenis dan Waktu dengan koma).');
                return;
            }

            const sessionType = details[0].trim();
            const timeInfo = details[1].trim();

            message.reply(`⏳ Membuka sesi baru dengan kode *${sessionCode}*...`);
            
            try {
                // Baca DB Lama atau Buat Baru
                let allSessions = {};
                if (fs.existsSync('./database_ptpt.json')) {
                    try {
                        const fileContent = fs.readFileSync('./database_ptpt.json', 'utf8');
                        // Cek apakah format lama (array) atau baru (object)?
                        // Kalau format lama, kita reset biar gak error.
                        const parsed = JSON.parse(fileContent);
                        if (!Array.isArray(parsed)) {
                            allSessions = parsed;
                        }
                    } catch(e) {}
                }

                // Buat Object Sesi Baru
                allSessions[sessionCode] = {
                    sessionType: sessionType,
                    timeInfo: timeInfo,
                    participants: []
                };

                fs.writeFileSync('./database_ptpt.json', JSON.stringify(allSessions));

                // Simpan Gambar (Global untuk semua ptpt, atau replace yg lama)
                if (message.hasMedia) {
                    const media = await message.downloadMedia();
                    if(media) fs.writeFileSync('./ptpt_image.png', media.data, 'base64');
                }

                // Broadcast Pembukaan
                const chat = await message.getChat();
                let listText = '';
                for (let i = 1; i <= 20; i++) listText += `${i}.\n`;

                const PTPT_TEMPLATE = `📢 SESSION INFO OPEN (${sessionCode})
• Jenis: ${sessionType}
• Waktu: ${timeInfo}
• Status: OPEN (0/20)

--------LIST MEMBER---------
USN Wa / USN rblox
${listText}
_Ketik: .ptptlist ${sessionCode} [Username] untuk join!_`;

                let mentions = [];
                for(let participant of chat.participants) {
                    try { mentions.push(await client.getContactById(participant.id._serialized)); } catch (err) {}
                }

                if (fs.existsSync('./ptpt_image.png')) {
                    await chat.sendMessage(MessageMedia.fromFilePath('./ptpt_image.png'), { caption: PTPT_TEMPLATE, mentions: mentions });
                } else {
                    await chat.sendMessage(PTPT_TEMPLATE, { mentions: mentions });
                }
                console.log(`[ADMIN] Opened Session: ${sessionCode}`);

            } catch (error) {
                console.log('Error PTPT Open:', error);
                message.reply('❌ Gagal membuka sesi.');
            }
        }

        // 2. SET/EDIT SESI
        if(msg.startsWith('.ptptset')) {
            // Format: .ptptset [KODE] [InfoWaktuBaru]
            const rawBody = message.body.slice(8).trim();
            const firstSpace = rawBody.indexOf(' ');

            if (firstSpace === -1) {
                message.reply('⚠️ Format: .ptptset [KODE] [Info Waktu Baru]');
                return;
            }

            const sessionCode = rawBody.substring(0, firstSpace).toUpperCase();
            const newTimeInfo = rawBody.substring(firstSpace + 1).trim();

            if (!fs.existsSync('./database_ptpt.json')) return;

            try {
                const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
                let allSessions = JSON.parse(rawData);

                if (!allSessions[sessionCode]) {
                    message.reply(`❌ Sesi ${sessionCode} tidak ditemukan.`);
                    return;
                }

                allSessions[sessionCode].timeInfo = newTimeInfo;
                fs.writeFileSync('./database_ptpt.json', JSON.stringify(allSessions));
                message.reply(`✅ Info waktu sesi *${sessionCode}* berhasil diupdate.`);

            } catch (error) { message.reply('❌ Gagal update.'); }
        }

        // 3. PAID CONFIRMATION
        if(msg.startsWith('.ptptpaid')) {
            // Format: .ptptpaid [KODE] [NOMOR, NOMOR]
            const rawBody = message.body.slice(9).trim();
            const firstSpace = rawBody.indexOf(' ');

            if (firstSpace === -1) {
                message.reply('⚠️ Format: .ptptpaid [KODE] [Nomor Urut]');
                return;
            }

            const sessionCode = rawBody.substring(0, firstSpace).toUpperCase();
            const numbersText = rawBody.substring(firstSpace + 1).trim();

            if (!fs.existsSync('./database_ptpt.json')) return;

            try {
                const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
                let allSessions = JSON.parse(rawData);

                if (!allSessions[sessionCode]) {
                    message.reply(`❌ Sesi ${sessionCode} tidak ditemukan.`);
                    return;
                }

                const indices = numbersText.split(',').map(item => parseInt(item.trim()) - 1);
                let currentSession = allSessions[sessionCode];
                let updatedCount = 0;

                indices.forEach(index => {
                    if (currentSession.participants[index]) {
                        currentSession.participants[index].isPaid = true;
                        updatedCount++;
                    }
                });

                if (updatedCount === 0) {
                    message.reply('⚠️ Tidak ada member valid yang diupdate.');
                    return;
                }

                // Simpan
                allSessions[sessionCode] = currentSession;
                fs.writeFileSync('./database_ptpt.json', JSON.stringify(allSessions));

                // Broadcast Update
                const chat = await message.getChat();
                let listText = '';
                for (let i = 0; i < 20; i++) {
                    const num = i + 1;
                    if (currentSession.participants[i]) {
                        const paidIcon = currentSession.participants[i].isPaid ? ' ✅' : '';
                        listText += `${num}. ${currentSession.participants[i].name} / ${currentSession.participants[i].roblox}${paidIcon}\n`;
                    } else {
                        listText += `${num}.\n`;
                    }
                }

                const PTPT_TEMPLATE = `📢 *PAYMENT CONFIRMED (${sessionCode})*
• Jenis: ${currentSession.sessionType}
• Waktu: ${currentSession.timeInfo}

--------LIST MEMBER---------
USN Wa / USN rblox
${listText}
_Terima kasih yang sudah lunas!_ ✅`;

                let mentions = [];
                for(let participant of chat.participants) {
                    try { mentions.push(await client.getContactById(participant.id._serialized)); } catch (err) {}
                }

                if (fs.existsSync('./ptpt_image.png')) {
                    await chat.sendMessage(MessageMedia.fromFilePath('./ptpt_image.png'), { caption: PTPT_TEMPLATE, mentions: mentions });
                } else {
                    await chat.sendMessage(PTPT_TEMPLATE, { mentions: mentions });
                }

            } catch (error) { console.log(error); message.reply('❌ Error confirming payment.'); }
        }

        // 4. REMOVE MEMBER
        if(msg.startsWith('.ptptremove')) {
            // Format: .ptptremove [KODE] [NOMOR]
            const rawBody = message.body.slice(11).trim();
            const firstSpace = rawBody.indexOf(' ');

            if (firstSpace === -1) {
                message.reply('⚠️ Format: .ptptremove [KODE] [Nomor Urut]');
                return;
            }

            const sessionCode = rawBody.substring(0, firstSpace).toUpperCase();
            const targetIndex = parseInt(rawBody.substring(firstSpace + 1).trim()) - 1;

            if (!fs.existsSync('./database_ptpt.json')) return;

            try {
                const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
                let allSessions = JSON.parse(rawData);

                if (!allSessions[sessionCode]) {
                    message.reply(`❌ Sesi ${sessionCode} tidak ditemukan.`);
                    return;
                }

                let currentSession = allSessions[sessionCode];

                if (!currentSession.participants[targetIndex]) {
                    message.reply('⚠️ Slot kosong.');
                    return;
                }

                const removedName = currentSession.participants[targetIndex].name;
                currentSession.participants.splice(targetIndex, 1);

                allSessions[sessionCode] = currentSession;
                fs.writeFileSync('./database_ptpt.json', JSON.stringify(allSessions));
                message.reply(`✅ Sukses menghapus *${removedName}* dari sesi ${sessionCode}.`);

            } catch (error) { message.reply('❌ Gagal menghapus.'); }
        }

        // 5. RESET/DELETE SESSION
        if(msg.startsWith('.ptptreset')) {
            const rawBody = message.body.slice(10).trim();
            
            if (!rawBody) {
                message.reply('⚠️ Masukkan Kode Sesi yg mau dihapus, atau "ALL" untuk hapus semua.');
                return;
            }

            const sessionCode = rawBody.toUpperCase();

            if (!fs.existsSync('./database_ptpt.json')) {
                message.reply('⚠️ Database sudah kosong.');
                return;
            }

            try {
                if (sessionCode === 'ALL') {
                    fs.unlinkSync('./database_ptpt.json');
                    if(fs.existsSync('./ptpt_image.png')) fs.unlinkSync('./ptpt_image.png');
                    message.reply('✅ *SEMUA DATA SESI DIHAPUS BERSIH!*');
                } else {
                    const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
                    let allSessions = JSON.parse(rawData);

                    if (allSessions[sessionCode]) {
                        delete allSessions[sessionCode]; // Hapus sesi spesifik
                        fs.writeFileSync('./database_ptpt.json', JSON.stringify(allSessions));
                        message.reply(`✅ Sesi *${sessionCode}* berhasil dihapus.`);
                    } else {
                        message.reply(`❌ Sesi ${sessionCode} tidak ditemukan.`);
                    }
                }
            } catch (error) { message.reply('❌ Gagal reset.'); }
        }
    }
});

client.initialize();