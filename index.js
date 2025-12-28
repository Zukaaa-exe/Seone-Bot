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

// --- SYARAT & KETENTUAN VILOG (REVISI V37) ---
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
• Silakan kirim Username & Password *HANYA MELALUI DM* ke Admin yang bersangkutan.
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
✤ *.PTPTLIST (USN)*
✤ *.PTPTUPDATE* (Cek Info Sesi) 
✤ *.HELP*
✤ *.PING*`;

const HELP_ADMIN_ONLY = `
---------ADMIN ONLY------------
✤ *.GIGUPDATE* 
✤ *.GIGRESET*
✤ *.BOOSTERUPDATE* 
✤ *.BOOSTERRESET*
✤ *.VILOGUPDATE* (Coming Soon)
✤ *.VILOGTEST* (Cek Tampilan Vilog) ✅
✤ *.PTPTOPEN* (Buka Sesi Baru)
✤ *.PTPTSET* (Edit Jam Sesi)
✤ *.PTPTPAID* (Konfirmasi Bayar) ✅
✤ *.PTPTREMOVE* (Hapus Member)
✤ *.PTPTRESET* (Tutup/Hapus Sesi)
✤ *.P (teks)*`;

const HELP_FOOTER = `
_SeoneStore.ID - Happy Shopping!_ 🔥`;


// Settingan Bot
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        // BARIS INI WAJIB UNTUK TERMUX:
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Tambahkan ini
            '--disable-accelerated-2d-canvas', // Tambahkan ini
            '--no-first-run', // Tambahkan ini
            '--no-zygote', // Tambahkan ini
            '--single-process' // Tambahkan ini untuk menghemat RAM HP
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
            const media = MessageMedia.fromFilePath('./qris.png');
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
        
        // Template Vilog dengan TnC Baru
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

    // === FITUR PTPT LIST (MEMBER) ===
    if (msg.startsWith('.ptptlist')) {
        let robloxUser = message.body.slice(10).trim();
        
        // --- 1. CEK FORMAT MEMBER ---
        if (!robloxUser) {
            console.log(`[LOG] User salah format .ptptlist`);
            message.reply(`⚠️ *Format Salah!* Kamu lupa memasukkan username.

📝 *Format:*
.ptptlist [Username Roblox]

✅ *Contoh:*
.ptptlist DragonSlayer99`);
            return;
        }

        if (!fs.existsSync('./database_ptpt.json')) {
            message.reply('⚠️ Belum ada sesi PTPT yang dibuka oleh Admin.');
            return;
        }

        try {
            const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
            let ptptData = JSON.parse(rawData);

            if (ptptData.participants.length >= 20) {
                message.reply('❌ Yah, slot sudah penuh (20/20)! Tunggu sesi berikutnya ya.');
                return;
            }

            // === SATPAM USERNAME ROBLOX ===
            const isRobloxTaken = ptptData.participants.some(p => p.roblox.toLowerCase() === robloxUser.toLowerCase());

            if (isRobloxTaken) {
                console.log(`[LOG] Username Roblox duplicate detected: ${robloxUser}`);
                message.reply(`⚠️ Username Roblox *${robloxUser}* sudah terdaftar di list!`);
                return;
            }

            const contact = await message.getContact();
            const waName = contact.pushname || contact.number;
            const waNumber = contact.id._serialized;

            ptptData.participants.push({
                name: waName,
                roblox: robloxUser,
                id: waNumber,
                isPaid: false 
            });

            fs.writeFileSync('./database_ptpt.json', JSON.stringify(ptptData));
            console.log(`[LOG] User joined PTPT: ${robloxUser} (${waName})`);

            let listText = '';
            for (let i = 0; i < 20; i++) {
                const num = i + 1;
                if (ptptData.participants[i]) {
                    const paidIcon = ptptData.participants[i].isPaid ? ' ✅' : '';
                    listText += `${num}. ${ptptData.participants[i].name} / ${ptptData.participants[i].roblox}${paidIcon}\n`;
                } else {
                    listText += `${num}.\n`;
                }
            }

            const FINAL_TEMPLATE = `📢 SESSION INFO OPEN
• Jenis Sesi: ${ptptData.sessionType}
• Status: OPEN
• Tanggal: ${ptptData.customDate}
• Jam Mulai: ${ptptData.startTime} WIB
• Jam Selesai: ${ptptData.endTime} WIB
• Link Server: (akan muncul setelah sesi dimulai)

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

    // === FITUR PTPT UPDATE (VIEW INFO) ===
    if(msg === '.ptptupdate') {
        
        if (!fs.existsSync('./database_ptpt.json')) {
            message.reply('⚠️ Belum ada sesi aktif. Gunakan *.ptptopen* untuk membuat sesi baru.');
            return;
        }

        try {
            console.log(`[LOG] User requesting .ptptupdate`);
            const chat = await message.getChat();
            const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
            const ptptData = JSON.parse(rawData);

            let listText = '';
            for (let i = 0; i < 20; i++) {
                const num = i + 1;
                if (ptptData.participants[i]) {
                    const paidIcon = ptptData.participants[i].isPaid ? ' ✅' : '';
                    listText += `${num}. ${ptptData.participants[i].name} / ${ptptData.participants[i].roblox}${paidIcon}\n`;
                } else {
                    listText += `${num}.\n`;
                }
            }

            const PTPT_TEMPLATE = `📢 SESSION INFO REFRESH
• Jenis Sesi: ${ptptData.sessionType}
• Status: OPEN
• Tanggal: ${ptptData.customDate}
• Jam Mulai: ${ptptData.startTime} WIB
• Jam Selesai: ${ptptData.endTime} WIB
• Link Server: (akan muncul setelah sesi dimulai)

--------LIST MEMBER---------
USN Wa / USN rblox
${listText}
_List otomatis terupdate_ ✅`;

            let mentions = [];
            for(let participant of chat.participants) {
                try { mentions.push(await client.getContactById(participant.id._serialized)); } catch (err) {}
            }

            if (fs.existsSync('./ptpt_image.png')) {
                const mediaToSend = MessageMedia.fromFilePath('./ptpt_image.png');
                await chat.sendMessage(mediaToSend, { caption: PTPT_TEMPLATE, mentions: mentions });
            } else {
                await chat.sendMessage(PTPT_TEMPLATE, { mentions: mentions });
            }

        } catch (error) {
            console.log('Error PTPT Update:', error);
            message.reply('❌ Gagal menampilkan info sesi.');
        }
    }

    // --- AREA KHUSUS ADMIN ---
    if(msg === '.gigupdate' || msg === '.gigreset' || msg === '.boosterupdate' || msg === '.boosterreset' || msg === '.vilogupdate' || msg === '.vilogtest' || msg === '.ptptreset' || msg.startsWith('.ptptopen') || msg.startsWith('.ptptset') || msg.startsWith('.ptptremove') || msg.startsWith('.ptptpaid') || msg === '.testgreet' || msg.startsWith('.p ')) {
        
        if (!isUserAdmin(message)) {
            console.log(`[ALERT] Non-Admin tried to use admin command: ${msg}`);
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
            if(!textToSend) {
                message.reply(`⚠️ *Format Salah!* Masukkan teks broadcast.

📝 *Format:*
.p [Pesan Kamu]

✅ *Contoh:*
.p Halo semua, mabar yuk!`);
                return;
            }
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
             const TPL = `📢 *GIG STOCK UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *READY STOCK!* Cek .pay`;
             if(fs.existsSync('./pricelist.png')) {
                 await chat.sendMessage(MessageMedia.fromFilePath('./pricelist.png'), { caption: TPL, mentions: mentions });
             } else { await chat.sendMessage(TPL, { mentions: mentions }); }
             console.log(`[ADMIN] GIG Updated by Admin`);
        }

        if(msg === '.gigreset') {
            message.reply('⏳ _Menghapus data update GIG..._');
            try {
                if(fs.existsSync('./database_update.json')) fs.unlinkSync('./database_update.json');
                if(fs.existsSync('./pricelist.png')) fs.unlinkSync('./pricelist.png');
                
                message.reply('✅ *SUKSES!* Data GIG telah direset. (Member akan melihat "Belum ada update")');
                console.log(`[ADMIN] GIG Data RESET`);
            } catch (error) {
                console.log('Error Gig Reset:', error);
                message.reply('❌ Gagal mereset data GIG.');
            }
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
             const TPL = `📢 *BOOSTER UPDATE!* 📢\n🗓️ ${date} | 🕛 ${time} WIB\n\n🔥 *OPEN SLOT!* Cek .pay`;
             if(fs.existsSync('./pricelist_booster.png')) {
                 await chat.sendMessage(MessageMedia.fromFilePath('./pricelist_booster.png'), { caption: TPL, mentions: mentions });
             } else { await chat.sendMessage(TPL, { mentions: mentions }); }
             console.log(`[ADMIN] Booster Updated by Admin`);
        }

        if(msg === '.boosterreset') {
            message.reply('⏳ _Menghapus data update BOOSTER..._');
            try {
                if(fs.existsSync('./database_booster.json')) fs.unlinkSync('./database_booster.json');
                if(fs.existsSync('./pricelist_booster.png')) fs.unlinkSync('./pricelist_booster.png');
                
                message.reply('✅ *SUKSES!* Data Booster telah direset. (Member akan melihat "Belum ada update")');
                console.log(`[ADMIN] BOOSTER Data RESET`);
            } catch (error) {
                console.log('Error Booster Reset:', error);
                message.reply('❌ Gagal mereset data Booster.');
            }
        }

        // --- VILOG UPDATE (ADMIN - COMING SOON MODE) ---
        if(msg === '.vilogupdate') {
             // Output Coming Soon sesuai request
             message.reply('🚧 *FITUR VILOG UPDATE SEDANG DALAM PENGEMBANGAN* 🚧\n\n_Coming Soon!_ Tunggu update selanjutnya ya admin ganteng. 😎');
             console.log(`[ADMIN] VILOG Update accessed (Coming Soon state)`);
        }
        
        // --- VILOG TEST (ADMIN - CEK TAMPILAN) ---
        if(msg === '.vilogtest') {
            // Pake data waktu sekarang buat simulasi
            const { date, time } = getWaktuIndonesia();
            
            const VILOG_TEMPLATE_TEST = `🔐 *VIA LOGIN PRICELIST (TEST PREVIEW)* 🔐
🗓️ *Tanggal Update:* ${date}
🕛 *Pukul:* ${time} WIB

${VILOG_TNC}

👇 *CARA PESAN:*
Tag admin yang bersangkutan dan ketik *.pay* untuk menampilkan QRIS payment.`;
            
            try {
                // Coba cek ada gambar pricelist_vilog.png atau tidak
                // Kalau admin belum upload, dia bakal kirim text aja + peringatan
                if (fs.existsSync('./pricelist_vilog.png')) {
                    const media = MessageMedia.fromFilePath('./pricelist_vilog.png');
                    await client.sendMessage(message.from, media, { caption: VILOG_TEMPLATE_TEST });
                } else {
                    message.reply(VILOG_TEMPLATE_TEST);
                    message.reply('⚠️ *Note:* Gambar `pricelist_vilog.png` tidak ditemukan di server. Ini tampilan text-only.');
                }
                console.log(`[ADMIN] VILOG TEST PREVIEW Executed`);
            } catch (error) {
                console.log('Error Vilog Test:', error);
                message.reply('❌ Gagal menjalankan test vilog.');
            }
        }

        // === 1. FITUR PTPT OPEN ===
        if(msg.startsWith('.ptptopen')) {
            const rawText = message.body.slice(9).trim(); 
            const args = rawText.split(',');

            if (args.length < 4) {
                console.log(`[ADMIN] Invalid .ptptopen format`);
                message.reply(`⚠️ *Format Salah!* Harap masukkan detail sesi.

📝 *Format:*
.ptptopen Jenis, Tanggal, Jam Mulai, Jam Selesai

✅ *Contoh Jadwal Fix:*
.ptptopen 12H, 30 Des, 20.00, 08.00

✅ *Contoh Jadwal TBA:*
.ptptopen 6H, TBA, TBA, TBA

*Note:* Jika jadwal belum diketahui, isi dengan TBA(To Be Announcement) pada bagian tanggal & jam.`);
                return;
            }

            const sessionType = args[0].trim();
            const customDate = args[1].trim();
            const startTime = args[2].trim();
            const endTime = args[3].trim();

            message.reply('⏳ _Mereset list & membuka sesi baru..._');
            
            try {
                const chat = await message.getChat();

                const newSessionData = {
                    sessionType: sessionType,
                    customDate: customDate,
                    startTime: startTime,
                    endTime: endTime,
                    participants: [] 
                };
                fs.writeFileSync('./database_ptpt.json', JSON.stringify(newSessionData));

                let hasImage = false;
                if (message.hasMedia) {
                    const media = await message.downloadMedia();
                    if(media) {
                        fs.writeFileSync('./ptpt_image.png', media.data, 'base64');
                        hasImage = true;
                    }
                }

                let listText = '';
                for (let i = 1; i <= 20; i++) listText += `${i}.\n`;

                const PTPT_TEMPLATE = `📢 SESSION INFO OPEN
• Jenis Sesi: ${sessionType}
• Status: OPEN
• Tanggal: ${customDate}
• Jam Mulai: ${startTime} WIB
• Jam Selesai: ${endTime} WIB
• Link Server: (akan muncul setelah sesi dimulai)

--------LIST MEMBER---------
USN Wa / USN rblox
${listText}
_Yang mau Join *Wajib Menggunakan bot* dengan ketik .ptptlist [username_roblox] agar di input otomatis_`;

                let mentions = [];
                for(let participant of chat.participants) {
                    try { mentions.push(await client.getContactById(participant.id._serialized)); } catch (err) {}
                }

                if (hasImage || fs.existsSync('./ptpt_image.png')) {
                    const mediaToSend = MessageMedia.fromFilePath('./ptpt_image.png');
                    await chat.sendMessage(mediaToSend, { caption: PTPT_TEMPLATE, mentions: mentions });
                } else {
                    await chat.sendMessage(PTPT_TEMPLATE, { mentions: mentions });
                }
                console.log(`[ADMIN] PTPT Session Opened: ${sessionType}`);

            } catch (error) {
                console.log('Error PTPT Open:', error);
                message.reply('❌ Gagal membuka sesi PTPT.');
            }
        }

        // === 2. FITUR PTPT SET (EDIT WAKTU) ===
        if(msg.startsWith('.ptptset')) {
            const rawText = message.body.slice(8).trim(); 
            const args = rawText.split(',');

            if (args.length < 3) {
                console.log(`[ADMIN] Invalid .ptptset format`);
                message.reply(`⚠️ *Format Salah!* Gunakan ini untuk revisi jadwal.

📝 *Format:*
.ptptset Tanggal, Jam Mulai, Jam Selesai

✅ *Contoh:*
.ptptset 30 Des, 20.00, 24.00`);
                return;
            }

            if (!fs.existsSync('./database_ptpt.json')) {
                message.reply('⚠️ Database kosong. Bikin sesi dulu pakai .ptptopen');
                return;
            }

            try {
                const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
                let ptptData = JSON.parse(rawData);

                ptptData.customDate = args[0].trim();
                ptptData.startTime = args[1].trim();
                ptptData.endTime = args[2].trim();

                fs.writeFileSync('./database_ptpt.json', JSON.stringify(ptptData));

                const chat = await message.getChat();
                
                let listText = '';
                for (let i = 0; i < 20; i++) {
                    const num = i + 1;
                    if (ptptData.participants[i]) {
                        const paidIcon = ptptData.participants[i].isPaid ? ' ✅' : '';
                        listText += `${num}. ${ptptData.participants[i].name} / ${ptptData.participants[i].roblox}${paidIcon}\n`;
                    } else {
                        listText += `${num}.\n`;
                    }
                }

                const PTPT_TEMPLATE = `📢 *SESSION INFO UPDATED!*
• Jenis Sesi: ${ptptData.sessionType}
• Status: OPEN
• Tanggal: ${ptptData.customDate} (FIX)
• Jam Mulai: ${ptptData.startTime} WIB (FIX)
• Jam Selesai: ${ptptData.endTime} WIB (FIX)
• Link Server: (akan muncul setelah sesi dimulai)

--------LIST MEMBER---------
USN Wa / USN rblox
${listText}
_Jadwal sudah fix ya guys!_ 🚀`;

                let mentions = [];
                for(let participant of chat.participants) {
                    try { mentions.push(await client.getContactById(participant.id._serialized)); } catch (err) {}
                }

                if (fs.existsSync('./ptpt_image.png')) {
                    const mediaToSend = MessageMedia.fromFilePath('./ptpt_image.png');
                    await chat.sendMessage(mediaToSend, { caption: PTPT_TEMPLATE, mentions: mentions });
                } else {
                    await chat.sendMessage(PTPT_TEMPLATE, { mentions: mentions });
                }
                console.log(`[ADMIN] PTPT Schedule Updated`);

            } catch (error) {
                console.log('Error PTPT Set:', error);
                message.reply('❌ Gagal update info sesi.');
            }
        }

        // === 3. FITUR PTPT PAID (KONFIRMASI BAYAR) ===
        if(msg.startsWith('.ptptpaid')) {
            const rawText = message.body.slice(9).trim(); 
            if (!rawText) {
                console.log(`[ADMIN] Invalid .ptptpaid format`);
                message.reply(`⚠️ *Format Salah!* Masukkan nomor urut member.

📝 *Format:*
.ptptpaid [Nomor Urut]

✅ *Contoh (Satu Orang):*
.ptptpaid 1

✅ *Contoh (Banyak):*
.ptptpaid 1, 3, 5`);
                return;
            }

            if (!fs.existsSync('./database_ptpt.json')) {
                message.reply('⚠️ Database kosong.');
                return;
            }

            try {
                const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
                let ptptData = JSON.parse(rawData);

                const indices = rawText.split(',').map(item => parseInt(item.trim()) - 1); 

                let updatedCount = 0;

                indices.forEach(index => {
                    if (ptptData.participants[index]) {
                        ptptData.participants[index].isPaid = true; 
                        updatedCount++;
                    }
                });

                if (updatedCount === 0) {
                    message.reply('⚠️ Tidak ada member di nomor tersebut.');
                    return;
                }

                fs.writeFileSync('./database_ptpt.json', JSON.stringify(ptptData));

                const chat = await message.getChat();
                let listText = '';
                for (let i = 0; i < 20; i++) {
                    const num = i + 1;
                    if (ptptData.participants[i]) {
                        const paidIcon = ptptData.participants[i].isPaid ? ' ✅' : '';
                        listText += `${num}. ${ptptData.participants[i].name} / ${ptptData.participants[i].roblox}${paidIcon}\n`;
                    } else {
                        listText += `${num}.\n`;
                    }
                }

                const PTPT_TEMPLATE = `📢 *PAYMENT CONFIRMED!*
• Jenis Sesi: ${ptptData.sessionType}
• Status: OPEN
• Tanggal: ${ptptData.customDate}
• Jam Mulai: ${ptptData.startTime} WIB
• Jam Selesai: ${ptptData.endTime} WIB

--------LIST MEMBER---------
USN Wa / USN rblox
${listText}
_Terima kasih yang sudah lunas!_ ✅`;

                let mentions = [];
                for(let participant of chat.participants) {
                    try { mentions.push(await client.getContactById(participant.id._serialized)); } catch (err) {}
                }

                if (fs.existsSync('./ptpt_image.png')) {
                    const mediaToSend = MessageMedia.fromFilePath('./ptpt_image.png');
                    await chat.sendMessage(mediaToSend, { caption: PTPT_TEMPLATE, mentions: mentions });
                } else {
                    await chat.sendMessage(PTPT_TEMPLATE, { mentions: mentions });
                }
                console.log(`[ADMIN] Confirmed payment for ${updatedCount} members`);

            } catch (error) {
                console.log('Error PTPT Paid:', error);
                message.reply('❌ Gagal update status bayar.');
            }
        }

        // === 4. FITUR PTPT REMOVE (HAPUS MEMBER) ===
        if(msg.startsWith('.ptptremove')) {
            const targetIndex = parseInt(message.body.slice(11).trim()) - 1; 

            if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= 20) {
                console.log(`[ADMIN] Invalid .ptptremove format`);
                message.reply(`⚠️ *Format Salah!* Masukkan nomor urut yang valid (1-20).

📝 *Format:*
.ptptremove [Nomor Urut]

✅ *Contoh:*
.ptptremove 3`);
                return;
            }

            if (!fs.existsSync('./database_ptpt.json')) { return; }

            try {
                const rawData = fs.readFileSync('./database_ptpt.json', 'utf8');
                let ptptData = JSON.parse(rawData);

                if (!ptptData.participants[targetIndex]) {
                    message.reply('⚠️ Slot nomor itu sudah kosong.');
                    return;
                }

                const removedName = ptptData.participants[targetIndex].name;
                ptptData.participants.splice(targetIndex, 1);

                fs.writeFileSync('./database_ptpt.json', JSON.stringify(ptptData));
                message.reply(`✅ Sukses menghapus *${removedName}* dari list.`);
                console.log(`[ADMIN] Removed member: ${removedName}`);

            } catch (error) {
                console.log('Error PTPT Remove:', error);
                message.reply('❌ Gagal menghapus member.');
            }
        }

        // === 5. FITUR PTPT RESET (HAPUS SESI TOTAL) ===
        if(msg === '.ptptreset') {
            message.reply('⏳ _Menghapus sesi & mereset data PTPT..._');
            try {
                if(fs.existsSync('./database_ptpt.json')) fs.unlinkSync('./database_ptpt.json');
                if(fs.existsSync('./ptpt_image.png')) fs.unlinkSync('./ptpt_image.png');
                
                message.reply('✅ *SUKSES!* Sesi PTPT telah ditutup dan data list dihapus.');
                console.log(`[ADMIN] PTPT Session RESET/CLOSED`);
            } catch (error) {
                console.log('Error PTPT Reset:', error);
                message.reply('❌ Gagal mereset sesi.');
            }
        }
    }
});

client.initialize();