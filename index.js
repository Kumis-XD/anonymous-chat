const TelegramBot = require('node-telegram-bot-api');
const token = '6523397148:AAGTHS7Vduo2VmltPSp9-sAufwrm5pIl5UE'; // Ganti dengan token bot Anda
const bot = new TelegramBot(token, { polling: true });
const adminChatId = '7142630474'; // Ganti dengan ID chat admin Anda

let waitingUser = null; // Menyimpan pengguna yang sedang menunggu pasangan
let activeChats = {}; // Menyimpan pasangan pengguna yang sedang chatting
let userPoints = {}; // Menyimpan poin pengguna
let userTimers = {}; // Menyimpan timer interaksi pengguna
let userHistory = {}; // Menyimpan riwayat obrolan pengguna
let userActivity = {}; // Menyimpan tingkat aktivitas pengguna
let userProfiles = {}; // Menyimpan profil pengguna
let userClaimDates = {}; // Menyimpan tanggal klaim terakhir untuk setiap pengguna

const updateUserProfile = (chatId, profile) => {
    userProfiles[chatId] = profile;
};

const getMainMenu = (options = {}) => {
    const buttons = [];

    if (options.showFindPartner || options.showStopChat || options.showNextChat) {
        buttons.push([
            options.showFindPartner ? { text: "🔍 Find Partner", callback_data: 'find_partner' } : null,
            options.showStopChat ? { text: "🚫 Stop Chat", callback_data: 'stop_chat' } : null,
            options.showNextChat ? { text: "⏩ Next Chat", callback_data: 'next_chat' } : null
        ].filter(Boolean));
    }

    if (options.showHistory) {
        buttons.push([
            options.showHistory ? { text: "🔁 Show History", callback_data: 'show_history' } : null
        ].filter(Boolean));
    }

    if (options.showStats || options.showBestUser || options.showMyPoints) {
        buttons.push([
            options.showStats ? { text: "📊 Show Stats", callback_data: 'show_stats' } : null,
            options.showBestUser ? { text: "✅ Best User", callback_data: 'best_user' } : null,
            options.showMyPoints ? { text: "💰 My Points", callback_data: 'my_points' } : null
        ].filter(Boolean));
    }

    if (options.showFindByGender || options.showFindByHobbies) {
        buttons.push([
            options.showFindByGender ? { text: "👤 Find by Gender", callback_data: 'find_by_gender' } : null,
            options.showFindByHobbies ? { text: "🎨 Find by Hobbies", callback_data: 'find_by_hobbies' } : null
        ].filter(Boolean));
    }

    if (options.showClaimPoints) {
        buttons.push([
            options.showClaimPoints ? { text: "🎁 Claim Points", callback_data: 'claim_points' } : null
        ].filter(Boolean));
    }
    
    if (options.showReport) {
        buttons.push([
            options.showReport ? { text: "🚨 Report to Admin", callback_data: 'report_to_admin' } : null
        ].filter(Boolean));
    }

    return {
        reply_markup: {
            inline_keyboard: buttons
        }
    };
};

const reportToAdmin = (chatId, partnerId) => {
    const message = `🚨 Laporan dari pengguna @${chatId}:\n\nPasangan ditemukan dengan @${partnerId}.`;
    bot.sendMessage(adminChatId, message);
};

// Menangani tombol laporkan ke admin saat pasangan ditemukan
const handlePartnerFound = (chatId, partnerId) => {
    bot.sendMessage(chatId, "🔍 Pasangan ditemukan! Mulai mengobrol dengan @${partnerId}.", getMainMenu({ showStopChat: true, showReport: true }));
    bot.sendMessage(partnerId, "🔍 Pasangan ditemukan! Mulai mengobrol dengan @${chatId}.", getMainMenu({ showStopChat: true, showReport: true }));

    // Laporkan ke admin
    reportToAdmin(chatId, partnerId);
};

const claimPoints = (chatId) => {
    const now = Date.now();
    const lastClaimDate = userClaimDates[chatId];
    
    if (lastClaimDate) {
        const fiveDaysInMillis = 5 * 24 * 60 * 60 * 1000; // 5 hari dalam milidetik
        if (now - lastClaimDate < fiveDaysInMillis) {
            bot.sendMessage(chatId, "❌ Anda sudah mengklaim poin dalam 5 hari terakhir. Cobalah lagi nanti.");
            return;
        }
    }
    
    // Tambah poin dan perbarui tanggal klaim
    if (!userPoints[chatId]) {
        userPoints[chatId] = 0;
    }
    userPoints[chatId] += 3;
    userClaimDates[chatId] = now;
    
    bot.sendMessage(chatId, "🎉 Anda telah berhasil mengklaim 3 poin!");
};

const handleProfileUpdate = (chatId, field, value) => {
    if (!userProfiles[chatId]) {
        userProfiles[chatId] = {};
    }
    userProfiles[chatId][field] = value;
    bot.sendMessage(chatId, `Profil Anda telah diperbarui: ${field} = ${value}`);
};

const reducePoints = (chatId, points) => {
    if (userPoints[chatId]) {
        userPoints[chatId] -= points;
        if (userPoints[chatId] < 0) userPoints[chatId] = 0;
    }
};

const findPartnerByCriteria = (chatId, criteria) => {
    const profile = userProfiles[chatId];

    if (!profile || !profile[criteria]) {
        bot.sendMessage(chatId, "❌ Profil Anda belum lengkap. Silakan lengkapi profil Anda terlebih dahulu.");
        return;
    }

    if (!userPoints[chatId] || userPoints[chatId] < 10) {
        bot.sendMessage(chatId, "❌ Anda tidak memiliki cukup poin. Kumpulkan poin hingga 10 poin atau lebih untuk fitur ini.");
        return;
    }

    reducePoints(chatId, 10);

    let foundPartner = false;

    for (let userId in userProfiles) {
        if (userId !== chatId && userProfiles[userId][criteria] === profile[criteria]) {
            bot.sendMessage(chatId, `🎉 Pasangan dengan kriteria ${criteria} ditemukan: @${userId}`, getMainMenu({ showStopChat: true, showReport: true }));
            foundPartner = true;
            break;
        }
    }

    if (!foundPartner) {
        bot.sendMessage(chatId, `❌ Tidak ada pasangan yang cocok dengan kriteria ${criteria}.`);
    }
};

// Fungsi untuk menambah poin
const addPoints = (chatId, points) => {
    if (!userPoints[chatId]) {
        userPoints[chatId] = 0;
    }
    userPoints[chatId] += points;
};

// Fungsi untuk menampilkan poin
const displayMyPoints = (chatId) => {
    const points = userPoints[chatId] || 0;
    bot.sendMessage(chatId, `💰 Poin Anda: ${points}`);
};

// Fungsi untuk menambah aktivitas pengguna
const addActivity = (chatId) => {
    if (!userActivity[chatId]) {
        userActivity[chatId] = { count: 0, messages: 0 };
    }
    userActivity[chatId].count += 1;
};

// Fungsi untuk menghapus timer pengguna
const clearInteractionTimer = (chatId) => {
    if (userTimers[chatId]) {
        clearTimeout(userTimers[chatId]);
        delete userTimers[chatId];
    }
};

// Fungsi untuk memulai timer 5 menit dan menambah poin
const startInteractionTimer = (chatId, partnerId) => {
    userTimers[chatId] = setTimeout(() => {
        addPoints(chatId, 15);
        addPoints(partnerId, 15);

        bot.sendMessage(chatId, "🎉 Anda telah berinteraksi selama 5 menit. Anda mendapatkan 15 poin!");
        bot.sendMessage(partnerId, "🎉 Anda telah berinteraksi selama 5 menit. Anda mendapatkan 15 poin!");
    }, 5 * 60 * 1000); // 5 menit dalam milidetik
};

// Fungsi untuk menampilkan riwayat obrolan
const displayChatHistory = (chatId) => {
    const history = userHistory[chatId] || [];
    if (history.length === 0) {
        bot.sendMessage(chatId, "❌ Anda belum memiliki riwayat obrolan.");
    } else {
        bot.sendMessage(chatId, "📜 Riwayat Obrolan:\n\n" + history.join('\n'));
    }
};

// Fungsi untuk menampilkan statistik pengguna
const displayUserStats = (chatId) => {
    const activity = userActivity[chatId] || { count: 0, messages: 0 };
    bot.sendMessage(chatId, `📊 Statistik Anda:\n\nJumlah Interaksi: ${activity.count}\nJumlah Pesan: ${activity.messages}`);
};

// Fungsi untuk menampilkan pengguna dengan poin terbanyak
const displayBestUser = (chatId) => {
    const bestUser = Object.keys(userPoints).reduce((best, user) => {
        return userPoints[user] > (userPoints[best] || 0) ? user : best;
    }, null);

    if (bestUser) {
        bot.sendMessage(chatId, `🏆 Pengguna Terbaik:\n\n@${bestUser} dengan ${userPoints[bestUser]} poin.`);
    } else {
        bot.sendMessage(chatId, "❌ Belum ada data pengguna terbaik.");
    }
};

// Fungsi untuk mengisi ulang poin pengguna
const refillUserPoints = (chatId, points) => {
    if (!userPoints[chatId]) {
        userPoints[chatId] = 0;
    }
    userPoints[chatId] += points;
};

// Menangani perintah admin untuk mengisi ulang poin pengguna
bot.onText(/\/refillpoints (\d+) (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = match[1];
    const points = parseInt(match[2], 10);

    // Cek apakah yang mengirim perintah adalah admin
    if (chatId.toString() === adminChatId) {
        if (userPoints[userId] !== undefined) {
            refillUserPoints(userId, points);
            bot.sendMessage(chatId, `✅ Poin pengguna @${userId} telah berhasil diisi ulang sebanyak ${points} poin.`);
            bot.sendMessage(userId, `🎉 Admin telah mengisi ulang ${points} poin ke akun Anda.`);
        } else {
            bot.sendMessage(chatId, `❌ Pengguna @${userId} tidak ditemukan.`);
        }
    } else {
        bot.sendMessage(chatId, "❌ Anda tidak memiliki izin untuk menggunakan perintah ini.");
    }
});

bot.onText(/\/setprofile (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const profile = match[1].split(',').map(v => v.trim());
    if (profile.length === 3) {
        handleProfileUpdate(chatId, 'age', profile[0]);
        handleProfileUpdate(chatId, 'gender', profile[1]);
        handleProfileUpdate(chatId, 'hobbies', profile[2]);
        bot.sendMessage(chatId, "Profil Anda telah diperbarui!");
    } else {
        bot.sendMessage(chatId, "Format profil tidak valid. Gunakan /setprofile <usia>,<jenis kelamin>,<hobi>");
    }
});

// Fungsi untuk menangani pesan
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (activeChats[chatId]) {
        const partnerId = activeChats[chatId];
        bot.sendMessage(partnerId, text);

        // Simpan riwayat obrolan
        if (!userHistory[chatId]) {
            userHistory[chatId] = [];
        }
        userHistory[chatId].push(`Anda: ${text}`);

        if (!userHistory[partnerId]) {
            userHistory[partnerId] = [];
        }
        userHistory[partnerId].push(`Partner: ${text}`);

        // Tambah aktivitas pengguna
        addActivity(chatId);
        addActivity(partnerId);

        // Tambah jumlah pesan
        if (userActivity[chatId]) {
            userActivity[chatId].messages += 1;
        }
        if (userActivity[partnerId]) {
            userActivity[partnerId].messages += 1;
        }
    }
});

// Saat pengguna memulai bot dengan perintah /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Selamat datang di Anonymous Chat! Pilih salah satu opsi di bawah ini:", getMainMenu({ showFindPartner: true,showFindByHobbies: true, showFindByGender: true, showHistory: true, showStats: true, showBestUser: true, showMyPoints: true, showClaimPoints: true }));
});

// Mengambil statistik pengguna
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;

    if (action === 'find_partner') {
        if (waitingUser) {
            const partnerId = waitingUser;
            activeChats[chatId] = partnerId;
            activeChats[partnerId] = chatId;

            bot.sendMessage(chatId, "Pasangan obrolan ditemukan! Mulai mengobrol.", getMainMenu({ showStopChat: true, showNextChat: true, showReport: true }));
            bot.sendMessage(partnerId, "Pasangan obrolan ditemukan! Mulai mengobrol.", getMainMenu({ showStopChat: true, showNextChat: true, showReport: true }));

            waitingUser = null;

            // Mulai timer 5 menit
            startInteractionTimer(chatId, partnerId);
        } else {
            waitingUser = chatId;
            bot.sendMessage(chatId, "Menunggu pengguna lain untuk terhubung...", getMainMenu({ showStopChat: true }));
        }
    } else if (action === 'stop_chat') {
        if (activeChats[chatId]) {
            const partnerId = activeChats[chatId];

            bot.sendMessage(partnerId, "Pasangan obrolan Anda telah keluar.", getMainMenu({ showFindPartner: true }));
            bot.sendMessage(chatId, "Anda telah meninggalkan obrolan.", getMainMenu({ showFindPartner: true }));

            clearInteractionTimer(chatId);
            clearInteractionTimer(partnerId);

            delete activeChats[partnerId];
            delete activeChats[chatId];
        } else if (waitingUser === chatId) {
            waitingUser = null;
            bot.sendMessage(chatId, "Anda telah keluar dari antrian.", getMainMenu({ showFindPartner: true }));
        } else {
            bot.sendMessage(chatId, "Anda tidak sedang dalam sesi obrolan.", getMainMenu({ showFindPartner: true }));
        }
    } else if (action === 'next_chat') {
        if (activeChats[chatId]) {
            const partnerId = activeChats[chatId];
            bot.sendMessage(partnerId, "Pasangan obrolan Anda telah keluar.", getMainMenu({ showFindPartner: true }));
            bot.sendMessage(chatId, "Anda telah meninggalkan obrolan. Mencari pasangan baru...", getMainMenu({ showStopChat: true }));

            clearInteractionTimer(chatId);
            clearInteractionTimer(partnerId);

            delete activeChats[partnerId];
            delete activeChats[chatId];
        }

        if (waitingUser) {
            const partnerId = waitingUser;
            activeChats[chatId] = partnerId;
            activeChats[partnerId] = chatId;

            bot.sendMessage(chatId, "Pasangan obrolan ditemukan! Mulai mengobrol.", getMainMenu({ showStopChat: true, showNextChat: true }));
            bot.sendMessage(partnerId, "Pasangan obrolan ditemukan! Mulai mengobrol.", getMainMenu({ showStopChat: true, showNextChat: true }));

            waitingUser = null;

            // Mulai timer 5 menit
            startInteractionTimer(chatId, partnerId);
        } else {
            waitingUser = chatId;
            bot.sendMessage(chatId, "Menunggu pengguna lain untuk terhubung...", getMainMenu({ showStopChat: true }));
        }
    } else if (action === 'show_history') {
        displayChatHistory(chatId);
    } else if (action === 'show_stats') {
        displayUserStats(chatId);
    } else if (action === 'best_user') {
        displayBestUser(chatId);
    } else if (action === 'my_points') {
        displayMyPoints(chatId);
    } else if (action === 'find_by_gender') {
        findPartnerByCriteria(chatId, 'gender');
    } else if (action === 'find_by_hobbies') {
        findPartnerByCriteria(chatId, 'hobbies');
    } else if (action === 'claim_points') {
        claimPoints(chatId);
    } else if (action === 'report_to_admin') {
        reportToAdmin(chatId, activeChats[chatId]);
        bot.sendMessage(chatId, "📩 Laporan Anda telah dikirim ke admin.");
    }
});
