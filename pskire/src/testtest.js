const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const PORT = 5000;

const app = express();
app.use(cors());
app.use(express.json());

// --- DATABASE CONFIGURATION ---
const dbConfig = {
    server: '127.0.0.1',
    port: 1433,
    database: 'psikoblog',
    user: 'psikoblog',
    password: 'Assaassa44',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

let pool;

// --- DATABASE CONNECTION ---
async function connectDB() {
    try {
        if (pool && pool.connected) {
            return true;
        }
        pool = await sql.connect(dbConfig);
        console.log('✅ Veritabanı bağlantısı başarılı');
        return true;
    } catch (hata) {
        console.error('❌ Veritabanı bağlantı hatası:', hata);
        pool = null;
        return false;
    }
}

connectDB();

app.get('api/kullanici/takipler/:userId', async (req,res) =>{

    const {userId} = req.params;
    const followersQuery = 'Select k.id, k.name, k.surname, k.username FROM Takipler as t INNER JOIN Kullanicilar as k ON t.takipEden_id = k.id WHERE t.takipEdilen_id=@userId';
    const followingQuery = 'Select k.id, k.name, k.surname, k.username FROM Takipler as t INNER JOIN Kullanicilar as k ON t.takipEdilen_id = k.id WHERE t.takipEden_id=@userId';
    const followerscount = 'Select COUNT(*) as TakipciSayisi FROM Takipler as t Where takipEdilen_id = @userId';
    const followingcount = 'Select COUNT(*) as TakipSayisi FROM Takipler as t Where takipEden_id = @userId';

    const [followersResult, followingResult, followerscountresult, followingcountresult] = await Promise.all([
           pool.request().input('userId', sql.Int, userId).query(followersQuery),
           pool.request().input('userId', sql.Int, userId).query(followingQuery),
           pool.request().input('userId', sql.Int, userId).query(followerscount),
           pool.request().input('userId', sql.Int, userId).query(followingcount)
       ]);

    res.status(200).json({
        takipciler:followersResult.recordset,
        takipler:followingResult.recordset,
        takipciSayisi:followerscountresult.recordset[0].TakipciSayisi,
        takipSayisi:followingcountresult.recordset[0].TakipSayisi

    })

})



// ... (sunucuyu başlatan app.listen kodunuz)
// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`✅ Backend sunucusu http://localhost:${PORT} adresinde başarıyla başlatıldı.`);
});

// --- GRACEFUL SHUTDOWN ---
process.on('SIGINT', async () => {
    console.log('\n🛑 Sunucu kapatılıyor...');
    if (pool) {
        await pool.close();
        console.log('✅ Veritabanı bağlantısı kapatıldı');
    }
    process.exit(0);
}); 