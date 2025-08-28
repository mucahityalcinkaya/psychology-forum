const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const pLimit = require('p-limit').default;
const dotenv = require('dotenv');

// Environment variables'ı yükle
dotenv.config();

const app = express();
const limit = pLimit(5);

// Google OAuth Client
const { OAuth2Client } = require('google-auth-library');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

// Middleware'ler
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? [process.env.FRONTEND_URL] // .env'de frontend URL'nizi belirtin
        : ['http://localhost:3000'],
    credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static('uploads')); // Static dosyalar için

app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://accounts.google.com/;");
    next();
});

// Database Configuration
const dbConfig = {
    server: process.env.DB_SERVER || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE || 'psikoblog',
    user: process.env.DB_USER || 'psikoblog',
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.NODE_ENV === 'production', // Production'da true
        trustServerCertificate: process.env.NODE_ENV !== 'production', // Development'ta true
        enableArithAbort: true
    }
};

const PORT = process.env.PORT || 5000;

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

let pool;

// Database Connection
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

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Server kapatılıyor...');
    if (pool) {
        await pool.close();
    }
    process.exit(0);
});

// uploads klasörü yoksa oluştur
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Multer Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Dosya adını güvenli hale getir
        const safeName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, safeName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Güvenlik için dosya türü kontrolü
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Sadece resim dosyaları yüklenebilir!'));
        }
    }
});

// Database bağlantısını başlat
connectDB();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: pool && pool.connected ? 'connected' : 'disconnected'
    });
});

const sendNewTestEmail = async (userName, userEmail, testName) => {
    try {
        const mailOptions = {
            from: '"Psikoblog Destek" <psikoblogbildirim@gmail.com>',
            to: userEmail,
            subject: `Yeni bir test yayında: ${testName}`,
            html: `
                <h3>Merhaba ${userName},</h3>
                <p>Sizin için harika bir haberimiz var!</p>
                <p>Platformumuzdaki "<b>${testName}</b>" adlı yeni psikolojik testimiz artık yayında.</p>
                <p>Bu test, kendinizi daha iyi anlamanıza ve iç dünyanız hakkında yeni keşifler yapmanıza yardımcı olabilir.</p>
                <p>Hemen şimdi testi çözmek için lütfen sitemizi ziyaret edin. Yeni testler ve içerikler için bizi takipte kalın!</p>
                <p>Teşekkürler,<br/>Psikoblog Ekibi</p>
            `
        };
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(`E-posta gönderilemedi: ${userEmail}`, error);
        // Hatanın Promise.all'ı kırmasını engellemek için hata fırlatmayı kaldırıyoruz.
        // Hatanın sadece loglanması yeterlidir.
    }
};

const sendDailyMorningEmail = async () => {
    try {
        if (!pool || !pool.connected) {
            await connectDB();
        }

        const request = pool.request();
        const usersResult = await request.query('SELECT name, surname, email FROM Kullanicilar');

        if (usersResult.recordset.length === 0) {
            console.log('E-posta gönderilecek kullanıcı bulunamadı.');
            return;
        }

        // p-limit ile her e-posta gönderimini bir görev olarak sıraya alıyoruz.
        const emailPromises = usersResult.recordset.map(user => {
            const userEmail = user.email;
            const userName = `${user.name} ${user.surname}`;

            const mailOptions = {
                from: '"Psikoblog Destek" <psikoblogbildirim@gmail.com>',
                to: userEmail,
                subject: 'Psikoblog\'dan Günaydın!',
                html: `
                    <h3>Günaydın ${userName},</h3>
                    <p>Bugün nasıl hissediyorsun?</p>
                    <p>Yatağın ters tarafından kalkmış gibi hissediyorsan endişelenme. Sadece biraz pozitifliğe ihtiyacın olabilir.</p>
                    <p>Kalk ve Psikoblog'a bir göz at. Belki de seni neşelendirecek bir şeyler bulursun!</p>
                    <p>Sevgiler,<br/>Psikoblog Ekibi</p>
                `
            };
            
            // `transporter.sendMail` Promise'ını `limit` fonksiyonuna sarmalıyoruz.
            return limit(() => transporter.sendMail(mailOptions));
        });

        // Tüm görevlerin tamamlanmasını bekliyoruz. Hataları yok saymak için Promise.allSettled kullanabiliriz.
        await Promise.allSettled(emailPromises);

        console.log('Günlük günaydın e-postaları tüm kullanıcılara başarıyla gönderildi.');

    } catch (error) {
        console.error('Günlük e-posta gönderimi sırasında bir hata oluştu:', error);
    }
};

// Cron görevi tanımlama
// '0 8 * * *' ifadesi her gün saat 08:00'de çalışacak demektir.
cron.schedule('0 8 * * *', () => {
    console.log('Günlük günaydın e-postası görevi çalışıyor...');
    sendDailyMorningEmail();
});
// E-posta gönderme fonksiyonunuzu güncelleyelim.
const sendWarningEmail = async (userName, userEmail, warningCount, nextBanDate) => {
    try {
        const mailOptions = {
            from: '"Psikoblog Destek" <psikoblogbildirim@gmail.com>',
            to: userEmail,
            subject: 'Hesabınız Uyarı Aldı',
            html: `
                <h3>Merhaba ${userName},</h3>
                <p>Hesabınıza moderatörler tarafından bir uyarı verildiğini bildirmek isteriz.</p>
                <p>Bu, **son 30 gün içinde aldığınız ${warningCount}.** uyarınızdır. Eğer **${nextBanDate}** tarihine kadar 3. uyarınızı alırsanız, hesabınız süresiz olarak askıya alınacaktır.</p>
                <p>Eğer bir hata olduğunu düşünüyorsanız, İletişim bölümünden bizimle iletişime geçiniz.</p>
                <p>Teşekkürler,<br/>Psikoblog Ekibi</p>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(`Uyarı bildirimi e-postası başarıyla gönderildi: ${userEmail}`);
    } catch (error) {
        console.error(`E-posta gönderilemedi: ${userEmail}`, error);
    }
};

const sendBanEmail = async (userName, userEmail, BanSebebi) => {
    try {
        const mailOptions = {
            from: '"Psikoblog Destek" <psikoblogbildirim@gmail.com>',
            to: userEmail,
            subject: 'Hesabınız Süresiz Banlandı',
            html: `
                <h3>Merhaba ${userName},</h3>
                <p>Hesabınıza moderatörler tarafından banlandığını bildirmek isteriz. Hesabınızın banlanma sebebi: "${BanSebebi}" </p>
                <p>Eğer bir hata olduğunu düşünüyorsanız, İletişim bölümünden bizimle iletişime geçiniz.</p>
                <p>Teşekkürler,<br/>Psikoblog Ekibi</p>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(`Ban bildirimi e-postası başarıyla gönderildi: ${userEmail}`);
    } catch (error) {
        console.error(`E-posta gönderilemedi: ${userEmail}`, error);
    }
};

const sendLoginNotificationEmail = async (userEmail, userName) => {
    try {
        const loginTime = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

        const mailOptions = {
            from: '"Psikoblog Destek" <psikoblogbildirim@gmail.com', // Gönderen adresi (kendi mailin)
            to: userEmail, // Alıcı adresi (giriş yapan kullanıcının maili)
            subject: 'Psikoblog Hesabınıza Giriş Yapıldı ✅', // E-posta konusu
            html: `
                <h3>Merhaba ${userName},</h3>
                <p>Hesabınıza <b>${loginTime}</b> tarihinde ve saatinde yeni bir giriş yapıldığını bildirmek istedik.</p>
                <p>Eğer bu girişi yapan siz değilseniz, lütfen hemen şifrenizi değiştirin ve güvenliğiniz için bizimle iletişime geçin.</p>
                <p>Teşekkürler,<br/>Psikoblog Ekibi</p>
            ` // E-postanın HTML içeriği
        };

        // E-postayı gönder
        await transporter.sendMail(mailOptions);
        console.log(`Giriş bildirimi e-postası başarıyla gönderildi: ${userEmail}`);

    } catch (error) {
        // E-posta gönderiminde bir hata olursa, bu hatayı logla ama programı durdurma
        console.error(`E-posta gönderilemedi: ${userEmail}`, error);
        // Hata fırlatabiliriz ama login işlemini engellememek daha iyi
        // throw error; 
    }
};

const sendRegisterEmail = async (userEmail, userName) => {
    try {
        // E-posta içeriğini ve seçeneklerini tanımla
        const mailOptions = {
            from: '"Psikoblog Destek" <psikoblogbildirim@gmail.com>', // Gönderen adresi
            to: userEmail, // Alıcı (yeni kayıt olan kullanıcı)
            subject: `Psikoblog Ailesine Hoş Geldin, ${userName}! 🎉`, // E-posta konusu
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                    <h2 style="color: #4A90E2;">Merhaba ${userName}, Psikoblog'a Hoş Geldin!</h2>
                    <p>Aramıza katıldığın için çok heyecanlıyız! Psikoblog hesabın başarıyla oluşturuldu.</p>
                    <p>Artık platformumuzdaki değerli yazıları okuyabilir, düşüncelerini yorum olarak paylaşabilir ve topluluğumuzun bir parçası olabilirsin.</p>
                    <p>Başlamak için aşağıdaki butona tıklayarak hemen keşfetmeye başlayabilirsin:</p>
                    <a href="https://www.google.com" style="background-color: #4A90E2; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
                        Hemen Başla
                    </a>
                    <p style="margin-top: 30px;">Bu e-postanın sana yanlışlıkla ulaştığını düşünüyorsan, bu bildirimi görmezden gelebilirsin.</p>
                    <p>Sevgiler,<br/><b>Psikoblog Ekibi</b></p>
                </div>
            ` // E-postanın HTML içeriği
        };

        // E-postayı nodemailer ile gönder
        await transporter.sendMail(mailOptions);
        console.log(`Kayıt karşılama e-postası başarıyla gönderildi: ${userEmail}`);

    } catch (error) {
        // E-posta gönderiminde bir hata olursa, bu hatayı logla ama programı durdurma.
        // Bu sayede e-posta servisi çökse bile kullanıcının kayıt işlemi başarısız olmaz.
        console.error(`Kayıt e-postası gönderilemedi: ${userEmail}`, error);
    }
};


const sendResetCodeEmail = async (userEmail, userName, code) => {
    try {
        const mailOptions = {
            from: '"Psikoblog Destek" <psikoblogbildirim@gmail.com>',
            to: userEmail,
            subject: 'Psikoblog Şifre Sıfırlama İsteği',
            html: `
                <h3>Merhaba ${userName},</h3>
                <p>Şifrenizi sıfırlamak için doğrulama kodunuz aşağıdadır. Bu kod 3 dakika geçerlidir.</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${code}</p>
                <p>Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
                <p>Teşekkürler,<br/>Psikoblog Ekibi</p>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(`Şifre sıfırlama kodu başarıyla gönderildi: ${userEmail}`);
    } catch (error) {
        console.error(`E-posta gönderilemedi: ${userEmail}`, error);
    }
};


app.post('/api/sifre-sifirla/istek', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'E-posta adresi gereklidir.' });
    }

    try {
        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();
        request.input('email', sql.NVarChar, email);

        const userResult = await request.query('SELECT id, username FROM Kullanicilar WHERE email = @email');

        if (userResult.recordset.length === 0) {
            // E-postanın sistemde olup olmadığını belli etmemek adına her zaman başarılı mesajı dönüyoruz.
            return res.status(200).json({ message: 'Eğer e-posta adresiniz sistemde kayıtlıysa, sıfırlama kodu gönderilmiştir.' });
        }

        const user = userResult.recordset[0];
        
        // 6 haneli rastgele bir kod üret
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();


        // Kodun geçerlilik süresini ayarla (3 dakika sonrası)
        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + 3);

        // Kodu ve geçerlilik süresini veritabanına kaydet
        const updateRequest = pool.request();
        updateRequest.input('id', sql.Int, user.id);
        updateRequest.input('resetCode', sql.NVarChar, resetCode);
        updateRequest.input('expiryDate', sql.DateTime, expiryDate);
        await updateRequest.query('UPDATE Kullanicilar SET sifirlamaKodu = @resetCode, sifirlamaKoduGecerlilik = @expiryDate WHERE id = @id');

        // Kullanıcıya e-posta gönder
        await sendResetCodeEmail(email, user.username, resetCode);

        return res.status(200).json({ message: 'Eğer e-posta adresiniz sistemde kayıtlıysa, sıfırlama kodu gönderilmiştir.' });

    } catch (error) {
        console.error('Şifre sıfırlama isteği hatası:', error);
        return res.status(500).json({ message: 'Sunucu tarafında bir hata oluştu.' });
    }
});


/**
 * 2. ADIM: Kodu doğrulama ve şifreyi GÜNCELLEME (Düz Metin olarak)
 * POST /api/sifre-sifirla/onayla
 * Body: { "email": "kullanici@mail.com", "kod": "123456", "yeniSifre": "YeniSifre123" }
 */
app.post('/api/sifre-sifirla/onayla', async (req, res) => {
    const { email, kod, yeniSifre } = req.body;

    if (!email || !kod || !yeniSifre) {
        return res.status(400).json({ message: 'E-posta, kod ve yeni şifre alanları zorunludur.' });
    }

    try {
        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();
        request.input('email', sql.NVarChar, email);

        const userResult = await request.query(
            'SELECT id, sifirlamaKodu, sifirlamaKoduGecerlilik FROM Kullanicilar WHERE email = @email'
        );

        if (userResult.recordset.length === 0) {
            return res.status(400).json({ message: 'Geçersiz istek.' });
        }

        const user = userResult.recordset[0];

        // Kodları ve geçerlilik süresini kontrol et
        if (user.sifirlamaKodu !== kod || new Date() > new Date(user.sifirlamaKoduGecerlilik)) {
             return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş sıfırlama kodu.' });
        }

        // --- DİKKAT: YENİ ŞİFRE DOĞRUDAN VERİTABANINA YAZILIYOR (GÜVENLİ DEĞİL!) ---
        const updateRequest = pool.request();
        updateRequest.input('id', sql.Int, user.id);
        updateRequest.input('yeniSifre', sql.NVarChar, yeniSifre); // Şifre düz metin
        await updateRequest.query(
            'UPDATE Kullanicilar SET password = @yeniSifre, sifirlamaKodu = NULL, sifirlamaKoduGecerlilik = NULL WHERE id = @id'
        );

        return res.status(200).json({ message: 'Şifreniz başarıyla güncellendi!' });

    } catch (error) {
        console.error('Şifre onaylama hatası:', error);
        return res.status(500).json({ message: 'Sunucu tarafında bir hata oluştu.' });
    }
});

app.post('/api/login/:provider?', async (req, res) => {
    try {
        const { provider } = req.params;
        if (!pool || !pool.connected) await connectDB();
        let user;

        // --- SENARYO 1: GOOGLE İLE GİRİŞ ---
        if (provider === 'google') {
            const { token } = req.body;
            if (!token) return res.status(400).json({ message: 'Google Token gerekli.' });

            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: CLIENT_ID,
            });
            const payload = ticket.getPayload();
            const { email, name, family_name, given_name } = payload;

            const findUserRequest = pool.request();
            findUserRequest.input('email', sql.NVarChar, email);
            const findUserResult = await findUserRequest.query(`
                SELECT k.*, ISNULL(r.rol_ad, 'kullanici') as rol FROM Kullanicilar k 
                LEFT JOIN UserRoller ur ON k.id = ur.user_id 
                LEFT JOIN Roller r ON ur.rol_id = r.id 
                WHERE k.email = @email
            `);

            if (findUserResult.recordset.length > 0) {
                user = findUserResult.recordset[0];
            } else {
                const newUserRequest = pool.request();
                newUserRequest.input('email', sql.NVarChar, email);
                newUserRequest.input('name', sql.NVarChar, given_name || name);
                newUserRequest.input('surname', sql.NVarChar, family_name || '');
                newUserRequest.input('password', sql.NVarChar, `google_sso_${Date.now()}`);
                const newUserResult = await newUserRequest.query(`
                    INSERT INTO Kullanicilar (name, surname, email, password, date)
                    OUTPUT INSERTED.*
                    VALUES (@name, @surname, @email, @password, GETDATE());
                `);
                const newUser = newUserResult.recordset[0];
                user = { ...newUser, rol: 'kullanici' };
            }
        } 
        // --- SENARYO 2: NORMAL E-POSTA/ŞİFRE İLE GİRİŞ ---
        else {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ message: 'E-posta ve şifre alanları zorunludur.' });
            }
            
            const request = pool.request();
            request.input('email', sql.NVarChar, email);
            const result = await request.query(`
                SELECT k.*, ISNULL(r.rol_ad, 'kullanici') AS rol 
                FROM Kullanicilar k
                LEFT JOIN UserRoller ur ON k.id = ur.user_id
                LEFT JOIN Roller r ON ur.rol_id = r.id
                WHERE k.email = @email
            `);

            if (result.recordset.length === 0 || password !== result.recordset[0].password) {
                return res.status(401).json({ message: 'E-posta veya şifre hatalı.' });
            }
            user = result.recordset[0];
        }

        // --- ORTAK İŞLEMLER (Her iki senaryo için de çalışır) ---

        // 1. Ban Kontrolü
        const banRequest = pool.request();
        banRequest.input('userId', sql.Int, user.id);
        const banResult = await banRequest.query(`SELECT sebep, ban_tarihi FROM BanlananKullanicilar WHERE user_id = @userId`);
        
        if (banResult.recordset.length > 0) {
            const banInfo = banResult.recordset[0];
            // DÜZELTME: Banlı kullanıcı için 'user' objesini de gönder
            return res.status(403).json({
                message: 'Hesabınız askıya alınmıştır.',
                banInfo: { sebep: banInfo.sebep, tarih: banInfo.ban_tarihi },
                user: user // Banlı kullanıcının objesini ekliyoruz
            });
        }

        // 2. Yeni Uyarıları Kontrol Etme
        let yeniUyarilar = [];
        if (user.son_giris_tarihi) {
            const uyariRequest = pool.request();
            uyariRequest.input('userId', sql.Int, user.id);
            uyariRequest.input('sonGiris', sql.DateTime, user.son_giris_tarihi);
            const uyariResult = await uyariRequest.query(`
                SELECT id, sebep, tarih FROM Uyari 
                WHERE user_id = @userId AND okundu_mu = 0 AND tarih > @sonGiris
            `);
            yeniUyarilar = uyariResult.recordset;
        }

        // 3. Son Giriş Tarihini Güncelleme
        const dateRequest = pool.request();
        dateRequest.input('userId', sql.Int, user.id);
        await dateRequest.query('UPDATE Kullanicilar SET son_giris_tarihi = GETDATE() WHERE id = @userId');

        // --- YENİ EKLENEN KISIM: E-POSTA GÖNDERME ---
        await sendLoginNotificationEmail(user.email, user.name);
        // ---------------------------------------------

        // 4. Başarılı Yanıtı Gönderme
        delete user.password;
        return res.status(200).json({ ...user, yeniUyarilar });
        
    } catch (hata) {
        console.error('❌ Login hatası:', hata);
        return res.status(500).json({ message: 'Sunucu tarafında bir hata oluştu.', error: hata.message });
    }
});

// src/index.js (veya ana server dosyanız)

// ... mevcut importlar ve diğer kodlar ...

app.get('/api/banli-panel-verisi/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const numericUserId = parseInt(userId);

        if (!pool || !pool.connected) await connectDB();
        
        const banRequest = pool.request();
        banRequest.input('userId', sql.Int, numericUserId);
        const banResult = await banRequest.query('SELECT * FROM BanlananKullanicilar WHERE user_id = @userId');

        if (banResult.recordset.length === 0) {
            return res.json({ banInfo: null });
        }
        
        const banInfo = banResult.recordset[0];
        
        const [
            uyarilarResult,
            sorularResult,
            yorumlarResult,
            paylasimlarResult,
            tartismalarResult,
            tartismaYorumlariResult,
        ] = await Promise.all([
            pool.request().input('userId', sql.Int, numericUserId).query('SELECT * FROM Uyari WHERE user_id = @userId ORDER BY tarih DESC'),
            pool.request().input('userId', sql.Int, numericUserId).query('SELECT id, title, content, date FROM ButunSorular WHERE user_id = @userId ORDER BY date DESC'),
            pool.request().input('userId', sql.Int, numericUserId).query('SELECT id, parent_id, content, date FROM ButunYorumlar WHERE user_id = @userId ORDER BY date DESC'),
            pool.request().input('userId', sql.Int, numericUserId).query('SELECT id, title, content, date FROM Paylasimlar WHERE user_id = @userId ORDER BY date DESC'),
            pool.request().input('userId', sql.Int, numericUserId).query('SELECT id, title, content, date FROM Tartismalar WHERE user_id = @userId ORDER BY date DESC'),
            pool.request().input('userId', sql.Int, numericUserId).query('SELECT id, parent_id, content, date FROM TumYorumlar WHERE user_id = @userId ORDER BY date DESC'),
        ]);

        return res.json({
            banInfo: banInfo,
            uyarilar: uyarilarResult.recordset,
            sorular: sorularResult.recordset,
            yorumlar: yorumlarResult.recordset,
            paylasimlar: paylasimlarResult.recordset,
            tartismalar: tartismalarResult.recordset,
            tartismaYorumlari: tartismaYorumlariResult.recordset,
        });

    } catch (hata) {
        console.error('Banlı panel verisi hatası:', hata);
        return res.status(500).json({ message: 'Sunucu hatası oluştu.' });
    }
});

app.post('/api/ban-itirazi', async (req, res) => {
    try {
        const { user_id, content } = req.body;
        
        if (!user_id || !content) {
            return res.status(400).json({ message: 'Eksik veya geçersiz itiraz bilgisi.' });
        }

        if (!pool || !pool.connected) await connectDB();
        
        const request = pool.request();
        request.input('user_id', sql.Int, user_id);
        request.input('content', sql.NVarChar, content);
        
        await request.query(`
            INSERT INTO Banitiraz (user_id, content, date)
            VALUES (@user_id, @content, GETDATE())
        `);

        return res.status(201).json({ message: 'İtirazınız başarıyla kaydedildi.' });

    } catch (hata) {
        console.error('Ban itirazı oluşturma hatası:', hata);
        return res.status(500).json({ message: 'Sunucu hatası oluştu.', error: hata.message });
    }
});
// YENİ TEST OLUŞTURMA API ENDPOINT'İ
app.post('/api/testekle', upload.any(), async (req, res) => {
    const transaction = new sql.Transaction(pool);
    const uploadedFilePaths = []; 

    try {
        const testData = JSON.parse(req.body.testData);
        const { testDetaylari, sonuclar, sorular } = testData;
        const files = req.files;

        if (files && files.length > 0) {
            files.forEach(f => uploadedFilePaths.push(f.path));
        }

        await transaction.begin();

        // Veritabanı işlemleri (test, sonuç ve soru ekleme)
        const testRequest = new sql.Request(transaction);
        testRequest.input('title', sql.NVarChar, testDetaylari.title);
        testRequest.input('description', sql.NVarChar, testDetaylari.description);
        testRequest.input('advice', sql.NVarChar, testDetaylari.advice);
        const testResult = await testRequest.query(`
            INSERT INTO Testler (title, description, advice)
            OUTPUT INSERTED.id
            VALUES (@title, @description, @advice);
        `);
        const newTestId = testResult.recordset[0].id;

        for (const sonuc of sonuclar) {
            const sonucRequest = new sql.Request(transaction);
            sonucRequest.input('id', sql.NVarChar, sonuc.id);
            sonucRequest.input('test_id', sql.Int, newTestId);
            sonucRequest.input('baslik', sql.NVarChar, sonuc.baslik);
            sonucRequest.input('aciklama', sql.NVarChar, sonuc.aciklama);
            await sonucRequest.query(`
                INSERT INTO Sonuclar (id, test_id, baslik, aciklama)
                VALUES (@id, @test_id, @baslik, @aciklama);
            `);
        }

        for (let i = 0; i < sorular.length; i++) {
            const soru = sorular[i];
            const file = files.find(f => f.fieldname === `soru_resim_${i}`);
            
            let imageBuffer = null;
            if (file) {
                imageBuffer = fs.readFileSync(file.path);
            }
            
            const soruRequest = new sql.Request(transaction);
            soruRequest.input('test_id', sql.Int, newTestId);
            soruRequest.input('soru_metni', sql.NVarChar, soru.soru_metni);
            soruRequest.input('image', sql.VarBinary(sql.MAX), imageBuffer);
            
            const soruResult = await soruRequest.query(`
                INSERT INTO Sorular (test_id, soru_metni, image)
                OUTPUT INSERTED.id
                VALUES (@test_id, @soru_metni, @image);
            `);
            const newSoruId = soruResult.recordset[0].id;

            for (const cevap of soru.cevaplar) {
                const cevapRequest = new sql.Request(transaction);
                cevapRequest.input('soru_id', sql.Int, newSoruId);
                cevapRequest.input('metin', sql.NVarChar, cevap.metin);
                cevapRequest.input('puan_tipi', sql.NVarChar, cevap.puan_tipi);
                await cevapRequest.query(`
                    INSERT INTO Cevaplar (soru_id, metin, puan_tipi)
                    VALUES (@soru_id, @metin, @puan_tipi);
                `);
            }
        }
        await transaction.commit();

        // Kullanıcılara e-posta gönderme işlemini sınırlıyoruz
        const kullanicilaristek = pool.request();
        const kullanicilarresult = await kullanicilaristek.query(`SELECT username, email, name, surname FROM Kullanicilar`);
        
        // p-limit ile her e-posta gönderimini bir görev olarak sıraya alıyoruz
        const emailPromises = kullanicilarresult.recordset.map(kullanici => {
            const userNameSurname = `${kullanici.name} ${kullanici.surname}`;
            // Her bir e-posta gönderimini `limit()` fonksiyonuyla sarmalıyoruz
            return limit(() => sendNewTestEmail(userNameSurname, kullanici.email, testDetaylari.title));
        });

        // Tüm görevlerin tamamlanmasını bekliyoruz
        await Promise.allSettled(emailPromises);

        res.status(201).json({ message: 'Test başarıyla oluşturuldu ve bildirimler gönderildi!', newTestId: newTestId });

    } catch (error) {
        if (transaction.active) await transaction.rollback();
        console.error('Test eklenirken hata:', error);
        res.status(500).json({ message: 'Test oluşturulurken bir hata oluştu.', error: error.message });
    } finally {
        uploadedFilePaths.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
    }
});
// DOSYA: backend/server.js

// TÜM TEST SONUÇ TİPLERİNİ GETİR
app.get('/api/test-sonuclari', async (req, res) => {
    try {
        if (!pool || !pool.connected) await connectDB();
        
        const result = await pool.request().query('SELECT id, baslik FROM Sonuclar');
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Test sonuçları çekilirken hata:', error);
        res.status(500).json({ message: 'Test sonuçları alınamadı.' });
    }
});


// UYARILARI OKUNDU OLARAK İŞARETLE
app.post('/api/kullanici/uyarilari-okundu', async (req, res) => {
    const { userId, uyariIds } = req.body;

    if (!userId || !uyariIds || !Array.isArray(uyariIds) || uyariIds.length === 0) {
        return res.status(400).json({ message: 'Kullanıcı ID ve Uyarı IDleri gereklidir.' });
    }

    try {
        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();

        const idParams = uyariIds.map((id, index) => `@id${index}`).join(',');
        uyariIds.forEach((id, index) => {
            request.input(`id${index}`, sql.Int, id);
        });
        request.input('userId', sql.Int, userId);

        await request.query(`
            UPDATE Uyari SET okundu_mu = 1 
            WHERE user_id = @userId AND id IN (${idParams})
        `);

        res.json({ message: 'Uyarılar okundu olarak işaretlendi.' });
    } catch (error) {
        console.error("Uyarılar güncellenirken hata:", error);
        res.status(500).json({ message: 'Uyarılar güncellenemedi.' });
    }
});

app.post('/api/yetkiver', async (req, res) => {
    try {
        // 1. Frontend'den gelen profil ID'sini ve atanacak yeni rol ID'sini alıyoruz.
        const { profilId, rolId } = req.body;

        // Gelen verilerin eksik olup olmadığını kontrol ediyoruz. Bu önemli bir güvenlik adımıdır.
        if (!profilId || !rolId) {
            return res.status(400).json({ message: 'Profil ID ve Rol ID gönderilmesi zorunludur.' });
        }

        // Veritabanı bağlantısını kontrol ediyoruz.
        if (!pool || !pool.connected) await connectDB();

        // 2. Önce kullanıcının rolünü UPDATE (güncelleme) yapmayı deniyoruz.
        const updateRequest = pool.request();
        updateRequest.input('userId', sql.Int, profilId);
        updateRequest.input('rolId', sql.Int, rolId);
        
        const updateResult = await updateRequest.query(`
            UPDATE UserRoller 
            SET rol_id = @rolId 
            WHERE user_id = @userId
        `);

        // 3. UPDATE sorgusunun kaç satırı etkilediğini kontrol ediyoruz.
        // Eğer etkilenen satır sayısı 0 ise, demek ki bu kullanıcının UserRoller tablosunda
        // daha önceden bir kaydı yokmuş.
        if (updateResult.rowsAffected[0] === 0) {
            console.log(`Kullanıcı (ID: ${profilId}) için mevcut rol bulunamadı. Yeni rol ekleniyor...`);
            
            // 4. Kayıt bulunamadığı için şimdi INSERT (ekleme) yapıyoruz.
            const insertRequest = pool.request();
            insertRequest.input('userId', sql.Int, profilId);
            insertRequest.input('rolId', sql.Int, rolId);
            
            await insertRequest.query(`
                INSERT INTO UserRoller (user_id, rol_id) 
                VALUES (@userId, @rolId)
            `);
        } else {
            console.log(`Kullanıcının (ID: ${profilId}) rolü başarıyla güncellendi.`);
        }

        // 5. İşlem her iki durumda da başarıyla tamamlandığı için frontend'e başarı mesajı gönderiyoruz.
        res.status(200).json({ message: 'Kullanıcının yetkisi başarıyla ayarlandı.' });

    } catch (error) {
        // 6. Herhangi bir veritabanı veya sunucu hatası olursa bunu yakalayıp logluyoruz.
        console.error('Yetki verme API hatası:', error);
        // Frontend'e de sunucuda bir hata olduğunu bildiriyoruz.
        res.status(500).json({ message: 'Sunucu tarafında bir hata oluştu.' });
    }
});

app.delete('/api/yetkial', async (req, res) => {
    try {
        // 1. Frontend'den gelen profil ID'sini ve atanacak yeni rol ID'sini alıyoruz.
        const { profilId} = req.body;

        // Gelen verilerin eksik olup olmadığını kontrol ediyoruz. Bu önemli bir güvenlik adımıdır.
        if (!profilId) {
            return res.status(400).json({ message: 'Profil ID gönderilmesi zorunludur.' });
        }

        // Veritabanı bağlantısını kontrol ediyoruz.
        if (!pool || !pool.connected) await connectDB();

        // 2. Önce kullanıcının rolünü UPDATE (güncelleme) yapmayı deniyoruz.
        const deleteRequest = pool.request();
        deleteRequest.input('userId', sql.Int, parseInt(profilId))
        const deleteResult = await deleteRequest.query(`
            Delete From UserRoller Where user_id = @userId
        `);
        if (deleteResult.rowsAffected[0] === 0) {
            console.log(`Kullanıcı (ID: ${profilId}) için Rol bulunamadı.`);
        } 

        // 5. İşlem her iki durumda da başarıyla tamamlandığı için frontend'e başarı mesajı gönderiyoruz.
        res.status(200).json({ message: 'Kullanıcı rolü  başarıyla silindi ayarlandı.' });

    } catch (error) {
        // 6. Herhangi bir veritabanı veya sunucu hatası olursa bunu yakalayıp logluyoruz.
        console.error('Yetki alma API hatası:', error);
        // Frontend'e de sunucuda bir hata olduğunu bildiriyoruz.
        res.status(500).json({ message: 'Sunucu tarafında bir hata oluştu.' });
    }
});

app.delete('/api/admin/kullanici-ban-kaldir/:userId', async (req, res) => {
        try {
            // 1. Frontend'den gelen userId parametresini alıyoruz
            const { userId } = req.params;

            // Gelen userId'nin geçerli olup olmadığını kontrol ediyoruz
            if (!userId || isNaN(userId)) {
                return res.status(400).json({ message: 'Geçersiz kullanıcı ID.' });
            }

            // Veritabanı bağlantısını kontrol ediyoruz
            if (!pool || !pool.connected) await connectDB();

            // 2. BanlananKullanicilar tablosundan kullanıcıyı sil
            const deleteRequest = pool.request();
            deleteRequest.input('userId', sql.Int, parseInt(userId));
            const deleteResult = await deleteRequest.query(`
                DELETE FROM BanlananKullanicilar WHERE user_id = @userId
            `);

            // 3. Silme işleminin başarılı olup olmadığını kontrol et
            if (deleteResult.rowsAffected[0] === 0) {
                console.log(`Kullanıcı (ID: ${userId}) için ban kaydı bulunamadı.`);
                return res.status(404).json({ message: 'Kullanıcı ban kaydı bulunamadı.' });
            }

            // 4. Başarıyla silindi, frontend'e başarı mesajı gönder
            res.status(200).json({ message: 'Kullanıcı banı başarıyla kaldırıldı.' });

        } catch (error) {
            // 5. Hata durumunda logla ve frontend'e hata mesajı gönder
            console.error('Ban kaldırma API hatası:', error);
            res.status(500).json({ message: 'Sunucu tarafında bir hata oluştu.' });
        }
    });

app.get('/api/roller', async (req,res)=>{

    try{
        if (!pool || !pool.connected) await connectDB();
        const result = await pool.request().query(`Select * FROM Roller`);
        res.status(200).json(result.recordset);
    }
    catch(error){
    // Gerçek hatanın ne olduğunu görmek için 'error' nesnesini yazdırıyoruz.
    console.error('Roller getirilirken bir hata oluştu:', error); 
    res.status(500).json({message:'Sunucu tarafında hata oluştu'})}

})


app.get('/api/kullanicilar/:id?', async (req, res) => {
    try {
        const { id } = req.params;
        if (!pool || !pool.connected) await connectDB();

        const baseQuery = `
            SELECT 
                k.*, 
                ISNULL(r.rol_ad, 'kullanici') AS rol 
            FROM Kullanicilar k
            LEFT JOIN UserRoller ur ON k.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
        `;

        if (id) {
            const numericId = parseInt(id);
            if (isNaN(numericId)) {
                return res.status(400).json({ message: 'Geçersiz ID formatı.' });
            }
            
            const request = pool.request();
            const query = `${baseQuery} WHERE k.id = @id`;
            request.input('id', sql.Int, numericId);
            
            const result = await request.query(query);

            if (result.recordset.length === 0) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            }
            
            return res.status(200).json(result.recordset[0]);
        } else {
            const request = pool.request();
            const result = await request.query(baseQuery);
            return res.status(200).json(result.recordset);
        }

    } catch (hata) {
        console.error('Kullanıcılar API Hatası:', hata);
        return res.status(500).json({ message: 'Kullanıcı verileri alınırken bir hata oluştu.' });
    }
});

app.get('/api/paylasimlar/:id?', async (req, res) => {
    try {
        const { id } = req.params;
        if (!pool || !pool.connected) await connectDB();

        if (id) {
            const numericId = parseInt(id);
            if (isNaN(numericId)) {
                return res.status(400).json({ message: 'Geçersiz ID formatı.' });
            }
            const request = pool.request();
            request.input('id', sql.Int, numericId);
            const result = await request.query('SELECT * FROM Paylasimlar WHERE user_id = @id ORDER BY date DESC');
            return res.json(result.recordset);
        }
        
        const result = await pool.request().query('SELECT * FROM Paylasimlar ORDER BY date DESC');
        return res.json(result.recordset);
    } catch (hata) {
        console.error('Paylaşımlar hatası:', hata);
        return res.status(500).json({ message: 'Paylaşımlar alınırken hata oluştu.' });
    }
});

app.get('/api/kullanicipves/:currentId/:userId?', async (req, res) => {
    try {
        const { userId, currentId } = req.params;

        // 1. Adım: Hangi kullanıcının profiline bakıldığını ve kimin baktığını belirliyoruz.
        // req.params'dan gelen değerler string olduğu için sayıya çevirerek karşılaştırmak en sağlıklısı.
        const profilSahibiId = parseInt(userId || currentId);
        const bakanKullaniciId = parseInt(currentId);

        if (!profilSahibiId) {
            return res.status(400).json({ message: 'Kullanıcı ID\'si eksik.' });
        }

        // YENİ: Profile bakan kişi, profilin sahibi mi diye kontrol ediyoruz.
        const isOwnerViewing = profilSahibiId === bakanKullaniciId;

        if (!pool || !pool.connected) await connectDB();

        // 2. Adım: Gerekli tüm verileri TEK BİR Promise.all ile paralel olarak çekiyoruz.
        const [
            paylasimlarResult,
            sorularResult,
            anonimPaylasimlarResult,
            anonimSorularResult,
            kaldirilanlarResult
        ] = await Promise.all([
            pool.request().input('profilId', sql.Int, profilSahibiId).query('SELECT * FROM Paylasimlar WHERE user_id = @profilId ORDER BY date DESC'),
            pool.request().input('profilId', sql.Int, profilSahibiId).query('SELECT * FROM ButunSorular WHERE user_id = @profilId ORDER BY date DESC'),
            pool.request().query('SELECT paylasim_id FROM AnonimPaylasimlar'),
            pool.request().query('SELECT soru_id FROM AnonimSorular'),
            pool.request().query('SELECT kaldirma_id, sikayet_anaid FROM Kaldirilanlar')
        ]);

        // 3. Adım: Filtreleme için kullanılacak ID listelerini (Set) oluşturuyoruz.
        const anonimPaylasimIds = new Set(anonimPaylasimlarResult.recordset.map(p => p.paylasim_id));
        const anonimSoruIds = new Set(anonimSorularResult.recordset.map(s => s.soru_id));
        const kaldirilanPaylasimIds = new Set();
        const kaldirilanSoruIds = new Set();

        kaldirilanlarResult.recordset.forEach(item => {
            if (item.sikayet_anaid === 1) { kaldirilanPaylasimIds.add(item.kaldirma_id); } 
            else if (item.sikayet_anaid === 2) { kaldirilanSoruIds.add(item.kaldirma_id); }
        });

        // 4. Adım: Filtrelemeyi KULLANICIYA GÖRE yapıyoruz.
        
        // Önce herkes için geçerli olan 'kaldırılmış' içerikleri filtrele
        let paylasimlar = paylasimlarResult.recordset.filter(p => 
            !kaldirilanPaylasimIds.has(p.id)
        );
        let sorular = sorularResult.recordset.filter(s => 
            !kaldirilanSoruIds.has(s.id)
        );

        // DİKKAT: EĞER profili gezen kişi, profilin sahibi DEĞİLSE, anonimleri de gizle.
        // Profil sahibi ise bu if bloğu çalışmaz ve anonimler listede kalır.
        if (!isOwnerViewing) {
            paylasimlar = paylasimlar.filter(p => !anonimPaylasimIds.has(p.id));
            sorular = sorular.filter(s => !anonimSoruIds.has(s.id));
        }

        // 5. Adım: Sonucu döndürüyoruz.
        return res.status(200).json({
            paylasimlar: paylasimlar,
            sorular: sorular
        });

    } catch (hata) {
        console.error('Kullanıcı içerik API Hatası:', hata);
        return res.status(500).json({ message: 'Kullanıcı içerikleri alınırken bir hata oluştu.' });
    }
});



app.get('/api/testler/:testId?', async (req, res) => {
    try {
        const { testId } = req.params;
        if (!pool || !pool.connected) await connectDB();

        if (testId) {
            const numericId = parseInt(testId);
            if (isNaN(numericId)) {
                return res.status(400).json({ message: 'Geçersiz ID formatı.' });
            }
            const request = pool.request();
            request.input('testId', sql.Int, numericId);
            const result = await request.query('SELECT * FROM Testler WHERE id = @testId');
            return res.json(result.recordset);
        }
        
        const result = await pool.request().query('SELECT * FROM Testler');
        return res.json(result.recordset);
    } catch (hata) {
        console.error('API hatası:', hata);
        return res.status(500).json({ message: 'Veri yüklenemedi.' });
    }
});

app.get('/api/anonimp', async (req, res) => {
    try {
        
        if (!pool || !pool.connected) await connectDB();      
        const result = await pool.request().query('SELECT * FROM AnonimPaylasimlar');
        return res.json(result.recordset);
    } catch (hata) {
        console.error('Anonim Paylaşımlar yüklenemedi', hata);
        return res.status(500).json({ message: 'Veri yüklenemedi.' });
    }
});

app.get('/api/anonims', async (req, res) => {
    try {
        if (!pool || !pool.connected) await connectDB();
        const result = await pool.request().query('SELECT * FROM AnonimSorular');
        return res.json(result.recordset);
    } catch (hata) {
        console.error('Anonim Sorular yüklenemedi', hata);
        return res.status(500).json({ message: 'Veri yüklenemedi.' });
    }
});

// Gerekli modüllerin başında sql'i eklediğinizden emin olun
// const sql = require('mssql');

app.get('/api/testsorular/:testId', async (req, res) => {
    try {
        const { testId } = req.params;
        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();
        request.input('testId', sql.Int, parseInt(testId));
        const result = await request.query('SELECT * FROM Sorular WHERE test_id = @testId ORDER BY id');

        // --- YENİ EKLENEN KISIM ---
        // Veritabanından gelen her bir kaydı işleyip resimleri Base64'e çeviriyoruz.
        const sorularWithBase64 = result.recordset.map(soru => {
            // Ham 'image' verisini (Buffer) ve sorunun geri kalanını ayır.
            const { image, ...restOfSoru } = soru;
            
            let image_data = null;
            let image_mime_type = null;

            // Eğer 'image' alanı doluysa ve bir Buffer ise (yani binary veri içeriyorsa)
            // onu Base64 formatına çevir.
            if (image && Buffer.isBuffer(image)) {
                image_data = image.toString('base64');
                // ÖNEMLİ: Veritabanında resim tipini (MIME type) saklamadığımız için
                // varsayılan olarak 'image/jpeg' kullanıyoruz. Eğer PNG gibi farklı
                // formatlarınız varsa bunu bilmenin bir yolu gerekir.
                image_mime_type = 'image/jpeg'; 
            }

            // Frontend'e gönderilecek yeni objeyi oluştur.
            return {
                ...restOfSoru, // id, soru_metni, test_id gibi diğer alanlar
                image_data,      // Base64'e çevrilmiş resim verisi
                image_mime_type  // Resmin tipi
            };
        });
        // --- DEĞİŞİKLİĞİN SONU ---

        // Ham veri yerine Base64'e çevrilmiş yeni diziyi frontend'e gönder.
        return res.json(sorularWithBase64);

    } catch (hata) {
        console.error('Sorular hatası:', hata);
        return res.status(500).json({ message: 'Sorular yüklenemedi.' });
    }
});

app.get('/api/cevaplar/:soruId', async (req, res) => {
    try {
        const { soruId } = req.params;
        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();
        request.input('soruId', sql.Int, parseInt(soruId));
        const result = await request.query('SELECT * FROM Cevaplar WHERE soru_id = @soruId ORDER BY id');
        return res.json(result.recordset);
    } catch (hata) {
        console.error('Cevaplar hatası:', hata);
        return res.status(500).json({ message: 'Cevaplar yüklenemedi.' });
    }
});

app.get('/api/sonuclar/:testId', async (req, res) => {
    try {
        const { testId } = req.params;
        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();
        request.input('testId', sql.Int, parseInt(testId));
        const result = await request.query('SELECT * FROM Sonuclar WHERE test_id = @testId ORDER BY id');
        return res.json(result.recordset);
    } catch (hata) {
        console.error('Sonuçlar hatası:', hata);
        return res.status(500).json({ message: 'Sonuçlar yüklenemedi.' });
    }
});

app.get('/api/hastaliklar', async (req, res) => {
    try {
        if (!pool || !pool.connected) await connectDB();
        const result = await pool.request().query('SELECT * FROM Hastaliklar');
        return res.json(result.recordset);
    } catch (hata) {
        console.error('Hastalıklar API Hatası:', hata);
        return res.status(500).json({ message: 'Veritabanına bağlanırken bir hata oluştu.' });
    }
});

app.get('/api/sorular/:id?', async (req, res) => {
    try {
        const { id } = req.params;
        if (!pool || !pool.connected) await connectDB();
        if(id){
            const numericId = parseInt(id);
            if (isNaN(numericId)) {
                return res.status(400).json({ message: 'Geçersiz ID formatı.' });
            }
            const request = pool.request();
            request.input('id', sql.Int, numericId);
            const result = await request.query('SELECT * FROM ButunSorular WHERE user_id=@id');
            return res.json(result.recordset);
        }
        const result = await pool.request().query('SELECT * FROM ButunSorular');
        return res.json(result.recordset);
    } catch (hata) {
        console.error('Sorular API Hatası:', hata);
        return res.status(500).json({ message: 'Sorular alınırken bir hata oluştu.' });
    }
});

app.post('/api/kayitol', async (req, res) => {
    try {
        const { username, name, surname, email, password, gender, birthdate } = req.body;
        if (!pool || !pool.connected) await connectDB();

        const request = pool.request();
        
        // Check if username or email already exists
        request.input('username', sql.NVarChar(50), username);
        request.input('email', sql.NVarChar(100), email);
        
        const checkQuery = `
            SELECT COUNT(*) as count 
            FROM Kullanicilar 
            WHERE username = @username OR email = @email
        `;
        
        const checkResult = await request.query(checkQuery);
        if (checkResult.recordset[0].count > 0) {
            return res.status(400).json({ 
                message: 'Bu kullanıcı adı veya email zaten kayıtlı.' 
            });
        }

        // Proceed with registration if no duplicates
        request.input('name', sql.NVarChar(50), name);
        request.input('surname', sql.NVarChar(50), surname);
        request.input('password', sql.NVarChar(255), password);
        request.input('gender', sql.NVarChar(10), gender);
        request.input('birthdate', sql.Date, birthdate);

        const insertQuery = `
            INSERT INTO Kullanicilar (username, name, surname, email, password, gender, age)
            VALUES (@username, @name, @surname, @email, @password, @gender, @birthdate)
        `;
        
        await request.query(insertQuery);
        await sendRegisterEmail(email, name);
        
        return res.status(201).json({ 
            message: 'Kayıt işlemi başarıyla tamamlandı.' 
        });
    } catch (hata) {
        console.error('Kayıt API Hatası:', hata);
        return res.status(500).json({ 
            message: 'Kayıt sırasında bir hata oluştu.' 
        });
    }
});

// DOSYA: backend/server.js

app.post('/api/google-register-check', async (req, res) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken) return res.status(400).json({ message: 'Google Access Token gerekli.' });

        // DEĞİŞİKLİK 1: 'personFields' listesinden 'genders' kaldırıldı.
        const googleResponse = await axios.get('https://people.googleapis.com/v1/people/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: {
                personFields: 'names,emailAddresses,birthdays' // 'genders' buradan silindi
            }
        });

        const profile = googleResponse.data;
        const email = profile.emailAddresses?.[0]?.value;
        if (!email) return res.status(400).json({ message: 'Google hesabınızdan e-posta bilgisi alınamadı.' });

        // E-posta kontrolü (değişiklik yok)
        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();
        request.input('email', sql.NVarChar, email);
        const result = await request.query('SELECT id FROM Kullanicilar WHERE email = @email');

        if (result.recordset.length > 0) {
            return res.status(409).json({ message: 'Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapmayı deneyin.' });
        }

        // Ön kayıt bilgilerini frontend'e gönder
        const given_name = profile.names?.[0]?.givenName;
        const family_name = profile.names?.[0]?.familyName;
        // DEĞİŞİKLİK 2: 'gender' bilgisi artık Google'dan alınmıyor.
        const birthdayData = profile.birthdays?.find(b => b.date && b.date.year);
        
        let birthdate = null;
        if (birthdayData) {
            const { year, month, day } = birthdayData.date;
            birthdate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        // DEĞİŞİKLİK 3: Frontend'e gönderilen yanıttan 'gender' kaldırıldı.
        res.json({
            email,
            name: given_name || '',
            surname: family_name || '',
            birthdate: birthdate
            // gender alanı artık burada yok
        });

    } catch (error) {
        console.error("Google Kayıt Kontrol Hatası:", error);
        res.status(500).json({ message: 'Google ile bilgi alınırken bir hata oluştu.' });
    }
});

app.put('/api/kullanicilar/:id/sifre-degistir', async (req, res) => {
    try {
        const { id } = req.params;
        const { eskiSifre, yeniSifre } = req.body;
        if (!pool || !pool.connected) await connectDB();

        const userRequest = pool.request();
        userRequest.input('id', sql.Int, id);
        const userResult = await userRequest.query('SELECT password FROM Kullanicilar WHERE id = @id');

        if (userResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        if (eskiSifre !== userResult.recordset[0].password) {
            return res.status(401).json({ message: 'Mevcut şifreniz yanlış.' });
        }

        const updateRequest = pool.request();
        updateRequest.input('id', sql.Int, id);
        updateRequest.input('yeniSifre', sql.NVarChar(255), yeniSifre);
        await updateRequest.query('UPDATE Kullanicilar SET password = @yeniSifre WHERE id = @id');

        return res.status(200).json({ message: 'Şifreniz başarıyla güncellendi!' });
    } catch (hata) {
        console.error('Şifre güncelleme hatası:', hata);
        return res.status(500).json({ message: 'Sunucu tarafında bir hata oluştu.' });
    }
});

app.get('/api/takipler/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!pool || !pool.connected) await connectDB();

        const followersQuery = `
            SELECT k.id, k.name, k.surname, k.username FROM Takipler AS t
            INNER JOIN Kullanicilar AS k ON t.takipEden_id = k.id
            WHERE t.takipEdilen_id = @userId
        `;
        const followingQuery = `
            SELECT k.id, k.name, k.surname, k.username FROM Takipler AS t
            INNER JOIN Kullanicilar AS k ON t.takipEdilen_id = k.id
            WHERE t.takipEden_id = @userId
        `;
        
        const [followersResult, followingResult] = await Promise.all([
            pool.request().input('userId', sql.Int, userId).query(followersQuery),
            pool.request().input('userId', sql.Int, userId).query(followingQuery)
        ]);

        return res.json({
            takipler: followingResult.recordset,
            takipciler: followersResult.recordset
        });
    } catch (hata) {
        console.error('Takip listesi hatası:', hata);
        return res.status(500).json({ message: 'Takip verileri alınırken bir hata oluştu.' });
    }
});

app.get('/api/takipediyormu/:userId/:currentid', async (req, res) => {
    try {
        const { userId, currentid } = req.params;
        if (!pool || !pool.connected) await connectDB();

        const sorgu = pool.request();
        sorgu.input('takipEdilen', sql.Int, userId);
        sorgu.input('takipEden', sql.Int, currentid);
        const sorguResult = await sorgu.query(`
            SELECT 1 FROM Takipler WHERE takipEden_id = @takipEden AND takipEdilen_id = @takipEdilen
        `);
        
        if (sorguResult.recordset.length > 0) {
            return res.json({ isFollowing: true });
        }
        return res.json({ isFollowing: false });
    } catch (hata) {
        console.error('Takip durumu hatası:', hata);
        return res.status(500).json({ message: 'Takip edip etmediği alınırken bir hata oluştu.' });
    }
});

app.post('/api/takip-et', async (req, res) => {
    try {
        const { takipEden_id, takipEdilen_id } = req.body;
        if (!takipEden_id || !takipEdilen_id) return res.status(400).json({ message: 'Eksik parametreler.' });
        if (takipEden_id === takipEdilen_id) return res.status(400).json({ message: 'Kendinizi takip edemezsiniz.' });
        if (!pool || !pool.connected) await connectDB();

        const checkRequest = pool.request();
        checkRequest.input('takipEden_id', sql.Int, takipEden_id);
        checkRequest.input('takipEdilen_id', sql.Int, takipEdilen_id);
        const existing = await checkRequest.query('SELECT 1 FROM Takipler WHERE takipEden_id = @takipEden_id AND takipEdilen_id = @takipEdilen_id');

        if (existing.recordset.length > 0) {
            return res.status(400).json({ message: 'Bu kullanıcıyı zaten takip ediyorsunuz.' });
        }

        const insertRequest = pool.request();
        insertRequest.input('takipEden_id', sql.Int, takipEden_id);
        insertRequest.input('takipEdilen_id', sql.Int, takipEdilen_id);
        await insertRequest.query('INSERT INTO Takipler (takipEden_id, takipEdilen_id) VALUES (@takipEden_id, @takipEdilen_id)');

        return res.status(201).json({ message: 'Takip başarılı.' });

    } catch (hata) {
        console.error('Takip ekleme hatası:', hata);
        return res.status(500).json({ message: 'Takip eklenirken hata oluştu.' });
    }
});

app.delete('/api/takibi-birak', async (req, res) => {
    try {
        const { takipEden_id, takipEdilen_id } = req.body;
        if (!takipEden_id || !takipEdilen_id) return res.status(400).json({ message: 'Eksik parametreler.' });
        if (!pool || !pool.connected) await connectDB();

        const request = pool.request();
        request.input('takipEden_id', sql.Int, takipEden_id);
        request.input('takipEdilen_id', sql.Int, takipEdilen_id);
        const result = await request.query('DELETE FROM Takipler WHERE takipEden_id = @takipEden_id AND takipEdilen_id = @takipEdilen_id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Takip ilişkisi bulunamadı.' });
        }
        return res.status(200).json({ message: 'Takip bırakıldı.' });
    } catch (hata) {
        console.error('Takibi bırakma hatası:', hata);
        return res.status(500).json({ message: 'Takibi bırakırken hata oluştu.' });
    }
});

app.delete('/api/takipci-cikar', async (req, res) => {
    try {
        const { takipEden_id, takipEdilen_id } = req.body;
        if (!takipEden_id || !takipEdilen_id) return res.status(400).json({ message: 'Eksik parametreler.' });
        if (!pool || !pool.connected) await connectDB();

        const request = pool.request();
        request.input('takipEden_id', sql.Int, takipEden_id);
        request.input('takipEdilen_id', sql.Int, takipEdilen_id);
        const result = await request.query('DELETE FROM Takipler WHERE takipEden_id = @takipEden_id AND takipEdilen_id = @takipEdilen_id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Takipçi bulunamadı.' });
        }
        return res.status(200).json({ message: 'Takipçi çıkarıldı.' });
    } catch (hata) {
        console.error('Takipçi çıkarma hatası:', hata);
        return res.status(500).json({ message: 'Takipçi çıkarırken hata oluştu.' });
    }
});



app.get('/api/hastaliklar/:hastalikSlug/detaylar', async (req, res) => {
    try {
        const { hastalikSlug } = req.params;
        if (!pool || !pool.connected) await connectDB();

        const hastalikRequest = pool.request();
        hastalikRequest.input('hastalikSlug', sql.NVarChar, hastalikSlug);
        const hastalikResult = await hastalikRequest.query('SELECT * FROM Hastaliklar WHERE slug = @hastalikSlug');

        if (hastalikResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Hastalık bulunamadı.' });
        }
        const secilenHastalik = hastalikResult.recordset[0];

        const [
            paylasimlarResult,
            kullanicilarResult,
            anonimPaylasimlarResult,
            userRollerResult,
            rollerResult,
            kaldirilanlarResult
        ] = await Promise.all([
            pool.request().input('hastalikId', sql.Int, secilenHastalik.id).query('SELECT * FROM Paylasimlar WHERE illness_id = @hastalikId ORDER BY date DESC'),
            pool.request().query('SELECT id, name, surname, username FROM Kullanicilar'),
            pool.request().query('SELECT paylasim_id FROM AnonimPaylasimlar'),
            pool.request().query('SELECT user_id, rol_id FROM UserRoller'),
            pool.request().query('SELECT id, rol_ad FROM Roller'),
            pool.request().query('SELECT kaldirma_id, sikayet_anaid FROM Kaldirilanlar')
        ]);

        const paylasimlar = paylasimlarResult.recordset;
        let ilaclar = [];
        let yanetkiler = [];
        let fotograflar = [];

        if (paylasimlar.length > 0) {
            const paylasimIds = paylasimlar.map(p => p.id);
            const idParameters = paylasimIds.map((_, index) => `@pid${index}`).join(',');

            const requestContainer = pool.request();
            paylasimIds.forEach((id, index) => {
                requestContainer.input(`pid${index}`, sql.Int, id);
            });
            
            const [ilacResult, yanetkiResult, fotografResult] = await Promise.all([
                requestContainer.query(`SELECT pi.paylasim_id, pi.content, i.id, i.medicine_name FROM PaylasimIlac pi JOIN Ilaclar i ON pi.medicine_id = i.id WHERE pi.paylasim_id IN (${idParameters})`),
                requestContainer.query(`SELECT py.paylasim_id, py.content, y.id, y.sideeffects_name FROM PaylasimYanetki py JOIN Yanetkiler y ON py.sideeffects_id = y.id WHERE py.paylasim_id IN (${idParameters})`),
                // DÜZELTME: Resim verisini Base64'e dönüştürüp frontend'e öyle gönderiyoruz.
                // SQL'de bu dönüşüm için uygun bir yöntem yok, bu yüzden sorgu sonucunu Node.js'te işleyeceğiz.
                requestContainer.query(`SELECT gonderi_id, image FROM Fotograflar WHERE tur_id = 1 AND gonderi_id IN (${idParameters})`)
            ]);

            ilaclar = ilacResult.recordset;
            yanetkiler = yanetkiResult.recordset;
            // DÜZELTME: Buffer objelerini Base64 string'e çeviriyoruz.
            fotograflar = fotografResult.recordset.map(foto => ({
                ...foto,
                image: foto.image ? foto.image.toString('base64') : null
            }));
        }

        return res.status(200).json({
            hastalik: secilenHastalik,
            paylasimlar: paylasimlar,
            paylasimIlac: ilaclar,
            paylasimYanetki: yanetkiler,
            paylasimFotograflar: fotograflar,
            kullanicilar: kullanicilarResult.recordset,
            anonimPaylasimlar: anonimPaylasimlarResult.recordset,
            userRoller: userRollerResult.recordset,
            roller: rollerResult.recordset,
            kaldirilanlar: kaldirilanlarResult.recordset
        });
    } catch (hata) {
        console.error('API Detay Hatası:', hata);
        return res.status(500).json({ message: 'Veri yüklenirken bir hata oluştu.' });
    }
});

app.get('/api/kullanicilar/:id/takip-sayilari', async (req, res) => {
    try {
        const { id } = req.params;
        if (!pool || !pool.connected) await connectDB();
        const numericId = parseInt(id);
        if(isNaN(numericId)){
             return res.status(400).json({ message: 'Geçersiz ID formatı.' });
        }

        const takipciQuery = 'SELECT COUNT(*) as takipciSayisi FROM Takipler WHERE takipEdilen_id = @userId';
        const takipEdilenQuery = 'SELECT COUNT(*) as takipEdilenSayisi FROM Takipler WHERE takipEden_id = @userId';

        const [takipciResult, takipEdilenResult] = await Promise.all([
            pool.request().input('userId', sql.Int, numericId).query(takipciQuery),
            pool.request().input('userId', sql.Int, numericId).query(takipEdilenQuery)
        ]);

        return res.json({
            takipciSayisi: takipciResult.recordset[0].takipciSayisi,
            takipEdilenSayisi: takipEdilenResult.recordset[0].takipEdilenSayisi
        });
    } catch (hata) {
        console.error('Takip sayıları hatası:', hata);
        return res.status(500).json({ message: 'Takip sayıları alınırken hata oluştu.' });
    }
});

// app.get('/api/main/:userId', ...) -> GÜNCELLENMİŞ KOD
app.get('/api/main/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ message: 'Kullanıcı ID\'si eksik.' });
        }
        if (!pool || !pool.connected) await connectDB();

        const followingResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT takipEdilen_id FROM Takipler WHERE takipEden_id = @userId');
            
        const followingIds = followingResult.recordset.map(r => r.takipEdilen_id);
        
        if (followingIds.length === 0) {
            return res.json({ paylasimlar: [], sorular: [], paylasimIlac: [], paylasimYanetki: [], kullanicilar: [], userRoller: [], roller: [] });
        }

        const idParameters = followingIds.map((_, index) => `@id${index}`).join(',');
        
        const paylasimlarRequest = pool.request();
        const sorularRequest = pool.request();
        const kullanicilarRequest = pool.request();

        followingIds.forEach((id, index) => {
            paylasimlarRequest.input(`id${index}`, sql.Int, id);
            sorularRequest.input(`id${index}`, sql.Int, id);
            kullanicilarRequest.input(`id${index}`, sql.Int, id);
        });

        const [
            paylasimlarResult,
            sorularResult,
            kullanicilarResult,
            anonimPaylasimlarResult,
            anonimSorularResult,         // YENİ: Anonim soruları çekiyoruz
            userRollerResult,
            rollerResult,
            kaldirilanlarResult
        ] = await Promise.all([
            paylasimlarRequest.query(`SELECT *, 'paylasim' as type FROM Paylasimlar WHERE user_id IN (${idParameters})`),
            sorularRequest.query(`SELECT *, 'soru' as type FROM ButunSorular WHERE user_id IN (${idParameters})`),
            kullanicilarRequest.query(`SELECT id, name, surname, username FROM Kullanicilar WHERE id IN (${idParameters})`),
            pool.request().query('SELECT paylasim_id FROM AnonimPaylasimlar'),
            pool.request().query('SELECT soru_id FROM AnonimSorular'), // YENİ: Anonim sorular sorgusu
            pool.request().query('SELECT user_id, rol_id FROM UserRoller'),
            pool.request().query('SELECT id, rol_ad FROM Roller'),
            pool.request().query('SELECT kaldirma_id, sikayet_anaid FROM Kaldirilanlar')
        ]);
        
        // DEĞİŞTİ: Filtreleme için ID setleri oluşturuyoruz
        const anonimPaylasimIds = new Set(anonimPaylasimlarResult.recordset.map(p => p.paylasim_id));
        const anonimSoruIds = new Set(anonimSorularResult.recordset.map(s => s.soru_id));

        const kaldirilanPaylasimIds = new Set();
        const kaldirilanSoruIds = new Set();
        kaldirilanlarResult.recordset.forEach(item => {
            if (item.sikayet_anaid === 1) { // 1 = Paylaşım
                kaldirilanPaylasimIds.add(item.kaldirma_id);
            } else if (item.sikayet_anaid === 2) { // 2 = Soru
                kaldirilanSoruIds.add(item.kaldirma_id);
            }
        });

        // DEĞİŞTİ: Paylaşımları filtreliyoruz
        const paylasimlar = paylasimlarResult.recordset
            .filter(p => !anonimPaylasimIds.has(p.id) && !kaldirilanPaylasimIds.has(p.id))
            .map(p => ({ ...p, type: 'paylasim' }));

        // DEĞİŞTİ: Soruları filtreliyoruz
        const sorular = sorularResult.recordset
            .filter(s => !anonimSoruIds.has(s.id) && !kaldirilanSoruIds.has(s.id))
            .map(s => ({ ...s, type: 'soru' }));
        
        let ilaclar = [];
        let yanetkiler = [];

        // Önemli: İlaç ve yan etkileri filtrelenmiş paylaşımlara göre çekiyoruz
        if (paylasimlar.length > 0) {
            const paylasimIds = paylasimlar.map(p => p.id);
            const paylasimIdParameters = paylasimIds.map((_, index) => `@pid${index}`).join(',');
            
            const ilacRequest = pool.request();
            const yanetkiRequest = pool.request();
            paylasimIds.forEach((id, index) => {
                ilacRequest.input(`pid${index}`, sql.Int, id);
                yanetkiRequest.input(`pid${index}`, sql.Int, id);
            });
            
            const [ilacResult, yanetkiResult] = await Promise.all([
                ilacRequest.query(`SELECT pi.paylasim_id, pi.content, i.id, i.medicine_name FROM PaylasimIlac pi JOIN Ilaclar i ON pi.medicine_id = i.id WHERE pi.paylasim_id IN (${paylasimIdParameters})`),
                yanetkiRequest.query(`SELECT py.paylasim_id, py.content, y.id, y.sideeffects_name FROM PaylasimYanetki py JOIN Yanetkiler y ON py.sideeffects_id = y.id WHERE py.paylasim_id IN (${paylasimIdParameters})`)
            ]);
            ilaclar = ilacResult.recordset;
            yanetkiler = yanetkiResult.recordset;
        }

        // DEĞİŞTİ: Yanıttan gereksiz listeleri kaldırıyoruz
        return res.status(200).json({
            paylasimlar: paylasimlar,
            sorular: sorular, 
            paylasimIlac: ilaclar,
            paylasimYanetki: yanetkiler,
            kullanicilar: kullanicilarResult.recordset,
            userRoller: userRollerResult.recordset,
            roller: rollerResult
        });

    } catch (hata) {
        console.error('Ana sayfa API Hatası:', hata);
        return res.status(500).json({ message: 'Ana sayfa verileri alınırken bir hata oluştu.' });
    }
});

// YENİ PAYLAŞIM SAYFASI İÇİN GEREKLİ VERİLERİ GETİREN ENDPOINT
// Bu endpoint, sayfa ilk yüklendiğinde hem hastalık detayını, hem de formdaki dropdown'lar için tüm ilaç ve yan etki listelerini tek seferde çeker.
app.get('/api/yeni-paylasim-veri/:hastalikSlug', async (req, res) => {
    // URL'den gelen dinamik parametreyi (`:hastalikSlug`) req.params objesinden alıyoruz.
    const { hastalikSlug } = req.params;
    
    // Asenkron işlemlerde olası hataları yakalamak için try-catch bloğu kullanıyoruz.
    try {
        // Veritabanı bağlantı havuzunun (pool) mevcut ve bağlı olup olmadığını kontrol ediyoruz. Değilse, yeniden bağlanıyoruz.
        if (!pool || !pool.connected) await connectDB();

        // Üç farklı sorguyu aynı anda (paralel olarak) çalıştırmak için Promise.all kullanıyoruz. 
        // Bu, sorguları art arda çalıştırmaktan çok daha hızlıdır ve performansı artırır.
        const [hastalikResult, ilaclarResult, yanetkilerResult] = await Promise.all([
            // 1. URL'deki slug'a göre ilgili hastalığı bul. Dışarıdan gelen veriyi `.input()` ile ekleyerek SQL Injection'ı önlüyoruz.
            pool.request().input('slug', sql.NVarChar, hastalikSlug).query('SELECT * FROM Hastaliklar WHERE slug = @slug'),
            
            // 2. Formdaki "ilaç seç" dropdown'ı için tüm ilaçları alfabetik sırayla çek.
            pool.request().query('SELECT * FROM Ilaclar ORDER BY medicine_name'),
            
            // 3. Formdaki "yan etki seç" dropdown'ı için tüm yan etkileri alfabetik sırayla çek.
            pool.request().query('SELECT * FROM Yanetkiler ORDER BY sideeffects_name')
        ]);

        // `recordset`, sorgudan dönen kayıtların (satırların) bulunduğu dizidir.
        // Eğer bu dizi boşsa, yani belirtilen slug'a sahip bir hastalık bulunamadıysa...
        if (hastalikResult.recordset.length === 0) {
            // Frontend'e 404 (Not Found) durum kodu ve bir hata mesajı gönder.
            return res.status(404).json({ message: 'Hastalık bulunamadı.' });
        }

        // Tüm veriler başarıyla çekildiyse, frontend'e tek bir JSON objesi içinde hepsini gönderiyoruz.
        return res.json({
            hastalik: hastalikResult.recordset[0], // Hastalık tek bir kayıt olduğu için dizinin ilk elemanını alıyoruz.
            tumIlaclar: ilaclarResult.recordset,   // Tüm ilaçların listesi.
            tumYanetkiler: yanetkilerResult.recordset // Tüm yan etkilerin listesi.
        });

    } catch (hata) {
        // `try` bloğu içinde herhangi bir hata olursa (örn: veritabanı bağlantı hatası), bu blok çalışır.
        console.error('Yeni paylaşım verileri çekilirken hata:', hata);
        // Frontend'e 500 (Internal Server Error) durum kodu ve genel bir hata mesajı gönder.
        return res.status(500).json({ message: 'Veri yüklenirken bir sunucu hatası oluştu.' });
    }
});

app.post('/api/paylasimkaydet', upload.array('images', 10), async (req, res) => {
    const transaction = new sql.Transaction(pool);
    const uploadedFilePaths = req.files ? req.files.map(f => f.path) : [];

    try {
        // --- DÜZELTİLEN KISIM: FormData içindeki string veriyi doğru şekilde ayrıştırıyoruz. ---
        // paylasimData, string'den parse edilmiş tam objeyi içerir.
        const paylasimData = JSON.parse(req.body.paylasim);
        
        // Bu obje içindeki anahtar-değer çiftlerine artık direkt erişebiliriz.
        const paylasim = {
            illness_id: paylasimData.illness_id,
            user_id: paylasimData.user_id,
            title: paylasimData.title,
            content: paylasimData.content,
            isAnonymous: paylasimData.isAnonymous
        };
        const ilaclar = paylasimData.ilaclar;
        const yanetkiler = paylasimData.yanetkiler;
        // --------------------------------------------------------------------------------------
        
        await transaction.begin();

        // ---- 1. ADIM: Ana Paylaşımı 'Paylasimlar' Tablosuna Ekleme ----
        const paylasimRequest = new sql.Request(transaction);
        paylasimRequest.input('illness_id', sql.Int, parseInt(paylasim.illness_id));
        paylasimRequest.input('user_id', sql.Int, parseInt(paylasim.user_id));
        paylasimRequest.input('title', sql.NVarChar, paylasim.title);
        paylasimRequest.input('content', sql.NVarChar, paylasim.content);
        
        const paylasimResult = await paylasimRequest.query(` 
            INSERT INTO Paylasimlar (illness_id, user_id, title, content, date) 
            OUTPUT inserted.id
            VALUES (@illness_id, @user_id, @title, @content, GETDATE())
        `);
        const newPaylasimId = paylasimResult.recordset[0].id;

        // ---- 2. ADIM: Anonim Olarak İşaretlendiyse 'AnonimPaylasimlar' Tablosuna Ekleme ----
        if (paylasim.isAnonymous) {
            const anonimRequest = new sql.Request(transaction);
            anonimRequest.input('paylasim_id', sql.Int, newPaylasimId);
            await anonimRequest.query('INSERT INTO AnonimPaylasimlar (paylasim_id) VALUES (@paylasim_id)');
        }

        // ---- 3. ADIM: Seçilen İlaçları 'PaylasimIlac' Tablosuna Ekleme ----
        if (ilaclar && ilaclar.length > 0) {
            for (const ilac of ilaclar) {
                const ilacRequest = new sql.Request(transaction);
                ilacRequest.input('paylasim_id', sql.Int, newPaylasimId);
                ilacRequest.input('medicine_id', sql.Int, ilac.medicine_id);
                ilacRequest.input('content', sql.NVarChar, ilac.content);
                await ilacRequest.query('INSERT INTO PaylasimIlac (paylasim_id, medicine_id, content) VALUES (@paylasim_id, @medicine_id, @content)');
            }
        }

        // ---- 4. ADIM: Seçilen Yan Etkileri 'PaylasimYanetki' Tablosuna Ekleme ----
        if (yanetkiler && yanetkiler.length > 0) {
            for (const yanetki of yanetkiler) {
                const yanetkiRequest = new sql.Request(transaction);
                yanetkiRequest.input('paylasim_id', sql.Int, newPaylasimId);
                yanetkiRequest.input('sideeffects_id', sql.Int, yanetki.sideeffects_id);
                yanetkiRequest.input('content', sql.NVarChar, yanetki.content);
                await yanetkiRequest.query('INSERT INTO PaylasimYanetki (paylasim_id, sideeffects_id, content) VALUES (@paylasim_id, @sideeffects_id, @content)');
            }
        }
        
        // ---- 5. ADIM: Yüklenen Fotoğrafları 'Fotograflar' Tablosuna Ekleme ----
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const imageBuffer = fs.readFileSync(file.path);
                const fotografRequest = new sql.Request(transaction);
                fotografRequest.input('tur_id', sql.Int, 1);
                fotografRequest.input('gonderi_id', sql.Int, newPaylasimId);
                fotografRequest.input('image', sql.VarBinary(sql.MAX), imageBuffer);
                await fotografRequest.query(`
                    INSERT INTO Fotograflar (tur_id, gonderi_id, image)
                    VALUES (@tur_id, @gonderi_id, @image)
                `);
            }
        }

        await transaction.commit();
        return res.status(201).json({ message: 'Paylaşımınız başarıyla gönderildi!', newPaylasimId: newPaylasimId });

    } catch (hata) {
        console.error("Paylaşım oluşturma hatası:", hata);
        if (transaction.active) {
            await transaction.rollback();
        }
        if (uploadedFilePaths.length > 0) {
            uploadedFilePaths.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }
        return res.status(500).json({ message: 'Paylaşım oluşturulurken bir sunucu hatası oluştu.' });
    }
});

// SORULAR LİSTESİ SAYFASI İÇİN VERİLERİ GETİREN ENDPOINT
// Endpoint adresi isteğiniz üzerine '/api/sorularlistesi' olarak güncellendi.

// ... (express, sql, pool gibi diğer importlarınız ve ayarlarınız)

// SORULAR LİSTESİ SAYFASI İÇİN VERİLERİ GETİREN ENDPOINT
// Adres: /api/sorularlistesi
app.get('/api/sorularlistesi', async (req, res) => {
    try {
        const { aramaTerimi, secilenHastalik, secilenIlac } = req.query;
        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();

        const [hastaliklarResult, ilaclarResult] = await Promise.all([
            pool.request().query('SELECT id, illness_name FROM Hastaliklar ORDER BY illness_name'),
            pool.request().query('SELECT id, medicine_name FROM Ilaclar ORDER BY medicine_name')
        ]);
        
        let sqlQuery = `
            WITH CommentCounts AS (
                SELECT 
                    SUBSTRING(parent_id, 2, LEN(parent_id)) AS question_id, 
                    COUNT(*) as comment_count
                FROM ButunYorumlar
                GROUP BY SUBSTRING(parent_id, 2, LEN(parent_id))
            )
            SELECT 
                s.id, s.title, s.content, s.date, s.user_id,
                u.name AS user_name,
                u.surname AS user_surname,
                CASE WHEN an.soru_id IS NOT NULL THEN 1 ELSE 0 END AS is_anonymous,
                ISNULL(cc.comment_count, 0) AS comment_count,
                (SELECT r.rol_ad FROM Roller r JOIN UserRoller ur ON r.id = ur.rol_id WHERE ur.user_id = s.user_id) as user_role
            FROM ButunSorular s
            LEFT JOIN Kullanicilar u ON s.user_id = u.id
            LEFT JOIN AnonimSorular an ON s.id = an.soru_id
            LEFT JOIN CommentCounts cc ON s.id = cc.question_id
            WHERE 1=1
        `;

        if (aramaTerimi) {
            sqlQuery += ` AND (s.title LIKE @aramaTerimi OR s.content LIKE @aramaTerimi OR EXISTS (
                SELECT 1 FROM ButunYorumlar c WHERE c.parent_id = 'q' + CAST(s.id AS VARCHAR) AND c.content LIKE @aramaTerimi
            ))`;
            request.input('aramaTerimi', sql.NVarChar, `%${aramaTerimi}%`);
        }
        if (secilenHastalik) {
            sqlQuery += ` AND EXISTS (SELECT 1 FROM SoruHastalik sh WHERE sh.soru_id = s.id AND sh.hastalik_id = @hastalikId)`;
            request.input('hastalikId', sql.Int, secilenHastalik);
        }
        if (secilenIlac) {
            sqlQuery += ` AND EXISTS (SELECT 1 FROM SoruIlac si WHERE si.soru_id = s.id AND si.ilac_id = @ilacId)`;
            request.input('ilacId', sql.Int, secilenIlac);
        }

        sqlQuery += ` AND s.id NOT IN (SELECT kaldirma_id FROM Kaldirilanlar WHERE sikayet_anaid = 2)`;
        sqlQuery += ` ORDER BY s.date DESC`;
        
        const sorularResult = await request.query(sqlQuery);
        
        const soruIdleri = sorularResult.recordset.map(s => s.id);
        let etiketler = { hastalıklar: [], ilaçlar: [] };
        let fotograflar = [];

        if (soruIdleri.length > 0) {
            const idList = soruIdleri.join(',');
            const [soruHastalikResult, soruIlacResult, fotografResult] = await Promise.all([
                pool.request().query(`SELECT sh.soru_id, h.id, h.illness_name FROM SoruHastalik sh JOIN Hastaliklar h ON sh.hastalik_id = h.id WHERE sh.soru_id IN (${idList})`),
                pool.request().query(`SELECT si.soru_id, i.id, i.medicine_name FROM SoruIlac si JOIN Ilaclar i ON si.ilac_id = i.id WHERE si.soru_id IN (${idList})`),
                // YENİ SORGUMUZ: Sorulara ait fotoğrafları çekiyoruz.
                pool.request().query(`SELECT gonderi_id, image FROM Fotograflar WHERE tur_id = 2 AND gonderi_id IN (${idList})`)
            ]);
            etiketler.hastalıklar = soruHastalikResult.recordset;
            etiketler.ilaçlar = soruIlacResult.recordset;
            // Buffer objelerini Base64 string'e çeviriyoruz
            fotograflar = fotografResult.recordset.map(foto => ({
                ...foto,
                image: foto.image ? foto.image.toString('base64') : null
            }));
        }

        const sonuclar = sorularResult.recordset.map(soru => ({
            ...soru,
            ilgiliHastaliklar: etiketler.hastalıklar.filter(h => h.soru_id === soru.id),
            ilgiliIlaclar: etiketler.ilaçlar.filter(i => i.soru_id === soru.id),
            fotograflar: fotograflar.filter(f => f.gonderi_id === soru.id)
        }));

        res.json({
            sorular: sonuclar,
            tumHastaliklar: hastaliklarResult.recordset,
            tumIlaclar: ilaclarResult.recordset
        });

    } catch (error) {
        console.error('Soru listesi alınırken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// SORU DETAY SAYFASI İÇİN API ENDPOINT'LERİ
// Backend'inizin server.js dosyasına eklenecek kodlar

// SORU DETAY SAYFASI İÇİN API ENDPOINT'LERİ
// Backend'inizin server.js dosyasına eklenecek kodlar
// SORU DETAY SAYFASI İÇİN API ENDPOINT'LERİ
// Backend'inizin server.js dosyasına eklenecek kodlar

// 1. SORU DETAYI İÇİN TEK BİR ENDPOINT (Soru + Yorumlar + Etiketler)
app.get('/api/sorudetay/:soruId', async (req, res) => {
    try {
        const { soruId } = req.params;
        const numericId = parseInt(soruId);
        
        if (isNaN(numericId)) {
            return res.status(400).json({ message: 'Geçersiz soru ID formatı.' });
        }
        
        if (!pool || !pool.connected) await connectDB();

        // 1. Soruyu getir
        const soruRequest = pool.request();
        soruRequest.input('soruId', sql.Int, numericId);
        
        const soruQuery = `
            SELECT 
                s.id, s.title, s.content, s.date, s.user_id,
                u.name AS user_name,
                u.surname AS user_surname,
                u.username,
                CASE WHEN an.soru_id IS NOT NULL THEN 1 ELSE 0 END AS is_anonymous,
                ISNULL(r.rol_ad, 'kullanici') AS user_role
            FROM ButunSorular s
            LEFT JOIN Kullanicilar u ON s.user_id = u.id
            LEFT JOIN AnonimSorular an ON s.id = an.soru_id
            LEFT JOIN UserRoller ur ON u.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE s.id = @soruId
                AND s.id NOT IN (SELECT kaldirma_id FROM Kaldirilanlar WHERE sikayet_anaid = 2)
        `;
        
        const soruResult = await soruRequest.query(soruQuery);
        
        if (soruResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Soru bulunamadı veya kaldırılmış.' });
        }
        
        const soru = soruResult.recordset[0];

        // 2. Paralel olarak diğer verileri getir
        const [
            yorumlarResult,
            hastalikEtiketResult,
            ilacEtiketResult,
            kullanicilarResult,
            rollerResult,
            kaldirilanlarResult,
            fotograflarResult // YENİ: Fotoğraflar için sorgu
        ] = await Promise.all([
            pool.request()
                .input('soruId', sql.Int, numericId)
                .query(`
                    WITH YorumIdleri AS (
                        SELECT 
                            id, parent_id, user_id, content, date, 0 as seviye
                        FROM ButunYorumlar
                        WHERE parent_id = 'q' + CAST(@soruId AS VARCHAR)
                        
                        UNION ALL
                        
                        SELECT 
                            y.id, y.parent_id, y.user_id, y.content, y.date, yh.seviye + 1
                        FROM ButunYorumlar y
                        INNER JOIN YorumIdleri yh ON y.parent_id = CAST(yh.id AS VARCHAR)
                        WHERE yh.seviye < 10
                    )
                    SELECT 
                        yi.id, yi.parent_id, yi.user_id, yi.content, yi.date,
                        u.name AS user_name, u.surname AS user_surname, u.username,
                        ISNULL(r.rol_ad, 'kullanici') AS user_role
                    FROM YorumIdleri yi
                    LEFT JOIN Kullanicilar u ON yi.user_id = u.id
                    LEFT JOIN UserRoller ur ON u.id = ur.user_id
                    LEFT JOIN Roller r ON ur.rol_id = r.id
                    ORDER BY yi.date ASC
                `),
            
            pool.request()
                .input('soruId', sql.Int, numericId)
                .query(`
                    SELECT h.id, h.illness_name, h.slug 
                    FROM SoruHastalik sh 
                    JOIN Hastaliklar h ON sh.hastalik_id = h.id 
                    WHERE sh.soru_id = @soruId
                `),
            
            pool.request()
                .input('soruId', sql.Int, numericId)
                .query(`
                    SELECT i.id, i.medicine_name 
                    FROM SoruIlac si 
                    JOIN Ilaclar i ON si.ilac_id = i.id 
                    WHERE si.soru_id = @soruId
                `),
            
            pool.request().query('SELECT id, name, surname, username FROM Kullanicilar'),
            
            pool.request().query('SELECT * FROM Roller'),
            
            pool.request().query('SELECT kaldirma_id, sikayet_anaid FROM Kaldirilanlar WHERE sikayet_anaid = 3'),
            
            // YENİ: Sorunun fotoğraflarını çek ve Base64'e dönüştür
            pool.request()
                .input('soruId', sql.Int, numericId)
                .query(`
                    SELECT image FROM Fotograflar 
                    WHERE tur_id = 2 AND gonderi_id = @soruId
                `)
        ]);

        const yorumlar = yorumlarResult.recordset;
        const hastaliklar = hastalikEtiketResult.recordset;
        const ilaclar = ilacEtiketResult.recordset;
        const kaldirilanYorumlar = kaldirilanlarResult.recordset.map(k => k.kaldirma_id);

        // FOTOĞRAF VERİSİNİ BASE64'E ÇEVİRME
        const fotograflar = fotograflarResult.recordset.map(foto => ({
            image: foto.image ? foto.image.toString('base64') : null
        }));

        // 3. Yorumları ağaç yapısına dönüştür
        const buildCommentTree = (comments, parentId) => {
            return comments
                .filter(comment => comment.parent_id === parentId)
                .map(comment => ({
                    ...comment,
                    children: buildCommentTree(comments, comment.id.toString())
                }))
                .sort((a, b) => new Date(a.date) - new Date(b.date));
        };

        const yorumAgaci = buildCommentTree(yorumlar, `q${numericId}`);

        // 4. Response'u hazırla
        return res.json({
            soru: {
                ...soru,
                hastaliklar: hastaliklar,
                ilaclar: ilaclar,
                fotograflar: fotograflar // FOTOĞRAFLAR EKLENDİ
            },
            yorumlar: yorumAgaci,
            kaldirilanYorumlar: kaldirilanYorumlar,
            kullanicilar: kullanicilarResult.recordset,
            roller: rollerResult.recordset
        });

    } catch (error) {
        console.error('Soru detayı alınırken hata:', error);
        return res.status(500).json({ message: 'Sunucu hatası oluştu.' });
    }
});

app.post('/api/sorusor', upload.array('images', 10), async (req, res) => {
    const transaction = new sql.Transaction(pool);
    const uploadedFilePaths = req.files ? req.files.map(f => f.path) : [];

    try {
        // DÜZELTME: FormData'dan gelen "soru" verisini doğru şekilde ayrıştırıyoruz.
        // soruData objesi artık user_id, title, content gibi alanları doğrudan içeriyor.
        const soruData = req.body.soru ? JSON.parse(req.body.soru) : {};
        const { user_id, title, content, isAnonymous, hastaliklar, ilaclar } = soruData;

        // Eksik veya geçersiz veri kontrolü
        if (!user_id || !title || !content) {
            return res.status(400).json({ message: 'Eksik veya geçersiz soru bilgisi.' });
        }

        await transaction.begin();

        // ---- 1. ADIM: Ana soruyu 'ButunSorular' tablosuna ekle ----
        const soruRequest = new sql.Request(transaction);
        soruRequest.input('user_id', sql.Int, user_id);
        soruRequest.input('title', sql.NVarChar, title);
        soruRequest.input('content', sql.NVarChar, content);
        
        const soruResult = await soruRequest.query(`
            INSERT INTO ButunSorular (user_id, title, content, date)
            OUTPUT inserted.id
            VALUES (@user_id, @title, @content, GETDATE())
        `);
        const newSoruId = soruResult.recordset[0].id;

        // ---- 2. ADIM: Anonim ise 'AnonimSorular' tablosuna ekle ----
        if (isAnonymous) {
            const anonimRequest = new sql.Request(transaction);
            anonimRequest.input('soru_id', sql.Int, newSoruId);
            await anonimRequest.query('INSERT INTO AnonimSorular (soru_id) VALUES (@soru_id)');
        }

        // ---- 3. ADIM: Hastalık etiketlerini 'SoruHastalik' tablosuna ekle ----
        if (hastaliklar && hastaliklar.length > 0) {
            for (const hastalikId of hastaliklar) {
                const hastalikRequest = new sql.Request(transaction);
                hastalikRequest.input('soru_id', sql.Int, newSoruId);
                hastalikRequest.input('hastalik_id', sql.Int, hastalikId);
                await hastalikRequest.query('INSERT INTO SoruHastalik (soru_id, hastalik_id) VALUES (@soru_id, @hastalik_id)');
            }
        }

        // ---- 4. ADIM: İlaç etiketlerini 'SoruIlac' tablosuna ekle ----
        if (ilaclar && ilaclar.length > 0) {
            for (const ilacId of ilaclar) {
                const ilacRequest = new sql.Request(transaction);
                ilacRequest.input('soru_id', sql.Int, newSoruId);
                ilacRequest.input('ilac_id', sql.Int, ilacId);
                await ilacRequest.query('INSERT INTO SoruIlac (soru_id, ilac_id) VALUES (@soru_id, @ilac_id)');
            }
        }
        
        // ---- 5. ADIM: Yüklenen Fotoğrafları 'Fotograflar' Tablosuna Ekleme ----
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const imageBuffer = fs.readFileSync(file.path);
                const fotografRequest = new sql.Request(transaction);
                fotografRequest.input('tur_id', sql.Int, 2); // 2: Soru
                fotografRequest.input('gonderi_id', sql.Int, newSoruId);
                fotografRequest.input('image', sql.VarBinary(sql.MAX), imageBuffer);
                await fotografRequest.query(`
                    INSERT INTO Fotograflar (tur_id, gonderi_id, image)
                    VALUES (@tur_id, @gonderi_id, @image)
                `);
            }
        }

        await transaction.commit();
        
        return res.status(201).json({ 
            message: 'Sorunuz başarıyla gönderildi!', 
            newSoruId: newSoruId 
        });

    } catch (error) {
        if (transaction.active) {
            await transaction.rollback();
        }
        if (uploadedFilePaths.length > 0) {
            uploadedFilePaths.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }
        console.error('Soru oluşturma hatası:', error);
        return res.status(500).json({ message: 'Soru oluşturulurken bir sunucu hatası oluştu.' });
    }
});

// 2. YENİ YORUM EKLEME ENDPOINT'İ
app.post('/api/yorumekle', async (req, res) => {
    try {
        const { parent_id, user_id, content } = req.body;
        
        // Validasyon
        if (!parent_id || !user_id || !content || !content.trim()) {
            return res.status(400).json({ message: 'Eksik veya geçersiz parametreler.' });
        }
        
        if (!pool || !pool.connected) await connectDB();
        
        // Parent_id'nin geçerli olup olmadığını kontrol et
        if (parent_id.startsWith('q')) {
            // Soruya yapılan yorumsa, sorunun var olup olmadığını kontrol et
            const soruId = parseInt(parent_id.substring(1));
            const soruCheck = await pool.request()
                .input('soruId', sql.Int, soruId)
                .query('SELECT id FROM ButunSorular WHERE id = @soruId');
            
            if (soruCheck.recordset.length === 0) {
                return res.status(404).json({ message: 'Yorum yapılmak istenen soru bulunamadı.' });
            }
        } else {
            // Başka bir yoruma yapılan cevapsa, o yorumun var olup olmadığını kontrol et
            const parentYorumId = parseInt(parent_id);
            const yorumCheck = await pool.request()
                .input('yorumId', sql.Int, parentYorumId)
                .query('SELECT id FROM ButunYorumlar WHERE id = @yorumId');
            
            if (yorumCheck.recordset.length === 0) {
                return res.status(404).json({ message: 'Cevap verilmek istenen yorum bulunamadı.' });
            }
        }
        
        // Yeni yorumu ekle
        const request = pool.request();
        request.input('parent_id', sql.NVarChar(50), parent_id);
        request.input('user_id', sql.Int, parseInt(user_id));
        request.input('content', sql.NVarChar(sql.MAX), content);
        
        const result = await request.query(`
            INSERT INTO ButunYorumlar (parent_id, user_id, content, date)
            OUTPUT inserted.*
            VALUES (@parent_id, @user_id, @content, GETDATE())
        `);
        
        const yeniYorum = result.recordset[0];
        
        // Kullanıcı bilgilerini de ekleyerek geri gönder
        const userRequest = pool.request();
        userRequest.input('userId', sql.Int, user_id);
        const userResult = await userRequest.query(`
            SELECT 
                u.name, u.surname, u.username,
                ISNULL(r.rol_ad, 'kullanici') AS user_role
            FROM Kullanicilar u
            LEFT JOIN UserRoller ur ON u.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE u.id = @userId
        `);
        
        const userData = userResult.recordset[0];
        
        return res.status(201).json({
            ...yeniYorum,
            user_name: userData.name,
            user_surname: userData.surname,
            username: userData.username,
            user_role: userData.user_role,
            children: []
        });
        
    } catch (error) {
        console.error('Yorum eklenirken hata:', error);
        return res.status(500).json({ message: 'Yorum eklenirken bir hata oluştu.' });
    }
});

// 3. YORUM SİLME ENDPOINT'İ (Soft Delete - Kaldirilanlar tablosuna ekler)
app.delete('/api/yorumsil/:yorumId', async (req, res) => {
    try {
        const { yorumId } = req.params;
        const { user_id, user_role} = req.body; // İsteği yapan kullanıcının bilgileri
        
        const numericYorumId = parseInt(yorumId);
        if (isNaN(numericYorumId)) {
            return res.status(400).json({ message: 'Geçersiz yorum ID.' });
        }
        
        if (!pool || !pool.connected) await connectDB();
        
        // Yorumu kontrol et
        const yorumRequest = pool.request();
        yorumRequest.input('yorumId', sql.Int, numericYorumId);
        const yorumResult = await yorumRequest.query(`
            SELECT y.*, r.rol_ad as sahip_rol
            FROM ButunYorumlar y
            LEFT JOIN UserRoller ur ON y.user_id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE y.id = @yorumId
        `);
        
        if (yorumResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Yorum bulunamadı.' });
        }
        
        const yorum = yorumResult.recordset[0];
        const yorumSahibiRol = yorum.sahip_rol || 'kullanici';
        
        // Yetki kontrolü
        const isMyComment = user_id === yorum.user_id;
        const isAdmin = user_role === 'admin';
        const isModerator = user_role === 'moderator';
        const commentOwnerIsAdmin = yorumSahibiRol === 'admin';
        
        if(isMyComment){
            const kaldirRequest = pool.request();
            kaldirRequest.input('id',sql.Int,parseInt(yorum.id))
        await kaldirRequest.query(`
            DELETE FROM ButunYorumlar WHERE id=@id )
        `);
        
        return res.json({ message: 'Yorum başarıyla kaldırıldı.' });

        }

        const canDelete = isAdmin || (isModerator && !commentOwnerIsAdmin);
        
        if (!canDelete) {
            return res.status(403).json({ message: 'Bu yorumu silme yetkiniz yok.' });
        }
        
        // Kaldirilanlar tablosuna ekle (soft delete)
        const kaldirRequest = pool.request();
        kaldirRequest.input('kaldirma_id', sql.Int, numericYorumId);
        kaldirRequest.input('sikayet_anaid', sql.Int, 3); // 3 = Yorumlar için
        
        await kaldirRequest.query(`
            INSERT INTO Kaldirilanlar (kaldirma_id, sikayet_anaid, kaldirma_tarihi)
            VALUES (@kaldirma_id, @sikayet_anaid, GETDATE())
        `);
        
        return res.json({ message: 'Yorum başarıyla kaldırıldı.' });
        
    } catch (error) {
        console.error('Yorum silinirken hata:', error);
        return res.status(500).json({ message: 'Yorum silinirken bir hata oluştu.' });
    }
});

// 4. YORUM ŞİKAYET ETME ENDPOINT'İ (Opsiyonel - şikayet sisteminiz varsa)
app.post('/api/yorumsikayet', async (req, res) => {
    try {
        const { yorum_id } = req.body;
        
        if (!yorum_id) {
            return res.status(400).json({ message: 'Eksik parametreler.' });
        }
        
        if (!pool || !pool.connected) await connectDB();
        
      
        const request = pool.request();
        request.input('yorum_id', sql.Int, yorum_id);
        request.input('sikayet_anaid', sql.Int, 3);
        await request.query(`
            INSERT INTO Sikayetler (sikayet_anaid,sikayet_id, sikayet_tarihi)
            VALUES (@sikayet_anaid, @yorum_id,GETDATE())
        `);
        
        
        // Şimdilik sadece başarılı mesajı dönelim
        return res.json({ message: 'Yorum şikayetiniz alındı ve incelenecektir.' });
        
    } catch (error) {
        console.error('Yorum şikayet edilirken hata:', error);
        return res.status(500).json({ message: 'Şikayet işlemi sırasında bir hata oluştu.' });
    }
});


app.delete('/api/sorusil/:soruId', async (req, res) => {
    // GÜVENLİK NOTU: kaldiran_id ve kaldiran_rol bilgileri,
    // güvendiğiniz bir kaynaktan (JWT'den gelen req.user gibi) alınmalıdır.
    // Şimdilik req.body'den almaya devam ediyoruz.
    const { kaldiran_id, kaldiran_rol } = req.body;
    const { soruId } = req.params;
    
    // --- Girdi Kontrolleri ---
    const numericSoruId = parseInt(soruId);
    const numericKaldiranId = parseInt(kaldiran_id);
    if (isNaN(numericSoruId) || isNaN(numericKaldiranId) || !kaldiran_rol) {
        return res.status(400).json({ message: 'Geçersiz veya eksik parametreler.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        if (!pool || !pool.connected) await connectDB();
        
        // --- 1. Adım: Soruyu ve Sahibinin Rolünü Veritabanından Çek ---
        const soruRequest = pool.request();
        soruRequest.input('soruId', sql.Int, numericSoruId);
        const soruResult = await soruRequest.query(`
            SELECT 
                s.id,
                s.user_id,
                ISNULL(r.rol_ad, 'kullanici') as sahip_rol
            FROM ButunSorular s
            JOIN Kullanicilar k ON s.user_id = k.id
            LEFT JOIN UserRoller ur ON k.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE s.id = @soruId
        `);

        if (soruResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Soru bulunamadı.' });
        }
        const soru = soruResult.recordset[0];

        // --- 2. Adım: Yetki Kontrolü ---
        const isOwner = numericKaldiranId === soru.user_id;
        const isAdmin = kaldiran_rol === 'admin';
        const isModerator = kaldiran_rol === 'moderator';
        const ownerIsAdmin = soru.sahip_rol === 'admin';

        // --- 3. Adım: Mantığa Göre Silme İşlemini Uygula ---

        // SENARYO 1: Silmek isteyen kişi sorunun sahibi.
        if (isOwner) {
            // KALICI SİLME (HARD DELETE) İŞLEMİ
            await transaction.begin();
            
            const request = new sql.Request(transaction);
            request.input('soruId', sql.Int, numericSoruId);
            request.input('parentPrefix', sql.VarChar, 'q' + numericSoruId);

            // Önce soruya bağlı tüm yorumları sil
            await request.query(`DELETE FROM ButunYorumlar WHERE parent_id LIKE @parentPrefix + '%'`);
            // Sonra sorunun kendisini sil
            await request.query(`DELETE FROM ButunSorular WHERE id = @soruId`);

            await transaction.commit();
            return res.json({ message: 'Sorunuz ve ilgili tüm yorumlar kalıcı olarak silindi.' });
        }

        // SENARYO 2: Silmek isteyen kişi admin veya moderatör (ama sorunun sahibi değil).
        const canSoftDelete = (isAdmin && !ownerIsAdmin) || (isModerator && !ownerIsAdmin);
        if (canSoftDelete) {
            // SADECE GİZLEME (SOFT DELETE) İŞLEMİ
            const kaldirRequest = pool.request();
            kaldirRequest.input('kaldirma_id', sql.Int, numericSoruId);
            kaldirRequest.input('kaldiran_id', sql.Int, numericKaldiranId);
            kaldirRequest.input('sikayet_anaid', sql.Int, 2); // 2 = Sorular için
            
            await kaldirRequest.query(`
                INSERT INTO Kaldirilanlar (sikayet_anaid, kaldirma_id, kaldiran_id, kaldirma_tarihi)
                VALUES (@sikayet_anaid, @kaldirma_id, @kaldiran_id, GETDATE())
            `);
            
            return res.json({ message: 'Soru başarıyla kaldırıldı ve arşivlendi.' });
        }

        // SENARYO 3: Yetkisiz erişim.
        // Eğer yukarıdaki koşullardan hiçbiri sağlanmazsa, kullanıcının yetkisi yoktur.
        return res.status(403).json({ message: 'Bu soruyu silme yetkiniz bulunmamaktadır.' });
        
    } catch (error) {
        if (transaction.active) {
            await transaction.rollback(); // Hata durumunda işlemi geri al
        }
        console.error('Soru silinirken hata:', error);
        return res.status(500).json({ message: 'Soru silinirken bir sunucu hatası oluştu.' });
    }
});


app.delete('/api/paylasimsil/:paylasimId', async (req, res) => {
    // GÜVENLİK NOTU: kaldiran_id ve kaldiran_rol bilgileri,
    // güvendiğiniz bir kaynaktan (JWT'den gelen req.user gibi) alınmalıdır.
    // Şimdilik req.body'den almaya devam ediyoruz.
    const { kaldiran_id, kaldiran_rol } = req.body;
    const { paylasimId } = req.params;
    
    // --- Girdi Kontrolleri ---
    const numericPaylasimId = parseInt(paylasimId);
    const numericKaldiranId = parseInt(kaldiran_id);
    if (isNaN(numericPaylasimId) || isNaN(numericKaldiranId) || !kaldiran_rol) {
        return res.status(400).json({ message: 'Geçersiz veya eksik parametreler.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        if (!pool || !pool.connected) await connectDB();
        
        // --- 1. Adım: Paylaşımı ve Sahibinin Rolünü Veritabanından Çek ---
        const paylasimRequest = pool.request();
        paylasimRequest.input('paylasimId', sql.Int, numericPaylasimId);
        const paylasimResult = await paylasimRequest.query(`
            SELECT 
                p.id,
                p.user_id,
                ISNULL(r.rol_ad, 'kullanici') as sahip_rol
            FROM Paylasimlar p
            JOIN Kullanicilar k ON p.user_id = k.id
            LEFT JOIN UserRoller ur ON k.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE p.id = @paylasimId
        `);

        if (paylasimResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Paylaşım bulunamadı.' });
        }
        const paylasim = paylasimResult.recordset[0];

        // --- 2. Adım: Yetki Kontrolü ---
        const isOwner = numericKaldiranId === paylasim.user_id;
        const isAdmin = kaldiran_rol === 'admin';
        const isModerator = kaldiran_rol === 'moderator';
        const ownerIsAdmin = paylasim.sahip_rol === 'admin';

        // --- 3. Adım: Mantığa Göre Silme İşlemini Uygula ---

        // SENARYO 1: Silmek isteyen kişi paylaşımın sahibi.
        if (isOwner) {
            // KALICI SİLME (HARD DELETE) İŞLEMİ
            await transaction.begin();
            
            const request = new sql.Request(transaction);
            request.input('paylasimId', sql.Int, numericPaylasimId);

            // Önce paylaşıma bağlı tüm ilişkili verileri sil
            await request.query(`DELETE FROM PaylasimIlac WHERE paylasim_id = @paylasimId`);
            await request.query(`DELETE FROM PaylasimYanetki WHERE paylasim_id = @paylasimId`);
            await request.query(`DELETE FROM AnonimPaylasimlar WHERE paylasim_id = @paylasimId`);
            // Varsa yorumlarını da sil (yorum tablonuzun adını ve ilişkisini buraya ekleyebilirsiniz)
            // await request.query(`DELETE FROM PaylasimYorumlar WHERE paylasim_id = @paylasimId`);
            
            // Son olarak paylaşımın kendisini sil
            await request.query(`DELETE FROM Paylasimlar WHERE id = @paylasimId`);

            await transaction.commit();
            return res.json({ message: 'Paylaşımınız ve ilgili tüm veriler kalıcı olarak silindi.' });
        }

        // SENARYO 2: Silmek isteyen kişi admin veya moderatör (ama paylaşımın sahibi değil).
        const canSoftDelete = (isAdmin && !ownerIsAdmin) || (isModerator && !ownerIsAdmin);
        if (canSoftDelete) {
            // SADECE GİZLEME (SOFT DELETE) İŞLEMİ
            const kaldirRequest = pool.request();
            kaldirRequest.input('kaldirma_id', sql.Int, numericPaylasimId);
            kaldirRequest.input('kaldiran_id', sql.Int, numericKaldiranId);
            kaldirRequest.input('sikayet_anaid', sql.Int, 1); // 1 = Paylaşımlar için
            
            await kaldirRequest.query(`
                INSERT INTO Kaldirilanlar (sikayet_anaid, kaldirma_id, kaldiran_id, kaldirma_tarihi)
                VALUES (@sikayet_anaid, @kaldirma_id, @kaldiran_id, GETDATE())
            `);
            
            return res.json({ message: 'Paylaşım başarıyla kaldırıldı ve arşivlendi.' });
        }

        // SENARYO 3: Yetkisiz erişim.
        return res.status(403).json({ message: 'Bu paylaşımı silme yetkiniz bulunmamaktadır.' });
        
    } catch (error) {
        if (transaction.active) {
            await transaction.rollback(); // Hata durumunda işlemi geri al
        }
        console.error('Paylaşım silinirken hata:', error);
        return res.status(500).json({ message: 'Paylaşım silinirken bir sunucu hatası oluştu.' });
    }
});
// PAYLAŞIM DETAY SAYFASI İÇİN TEK BİR ENDPOINT
app.get('/api/paylasimdetay/:paylasimId', async (req, res) => {
    try {
        const { paylasimId } = req.params;
        const numericId = parseInt(paylasimId);
        
        if (isNaN(numericId)) {
            return res.status(400).json({ message: 'Geçersiz paylaşım ID formatı.' });
        }
        
        if (!pool || !pool.connected) await connectDB();

        // 1. Ana paylaşım verisini ve ilişkili hastalık/kullanıcı bilgilerini getir
        const paylasimRequest = pool.request();
        paylasimRequest.input('paylasimId', sql.Int, numericId);
        
        const paylasimQuery = `
            SELECT 
                p.id, p.title, p.content, p.date, p.user_id, p.illness_id,
                u.name AS user_name,
                u.surname AS user_surname,
                h.illness_name AS hastalik_name,
                h.slug AS hastalik_slug,
                CASE WHEN ap.paylasim_id IS NOT NULL THEN 1 ELSE 0 END AS is_anonymous,
                ISNULL(r.rol_ad, 'kullanici') AS user_role
            FROM Paylasimlar p
            LEFT JOIN Kullanicilar u ON p.user_id = u.id
            LEFT JOIN Hastaliklar h ON p.illness_id = h.id
            LEFT JOIN AnonimPaylasimlar ap ON p.id = ap.paylasim_id
            LEFT JOIN UserRoller ur ON u.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE p.id = @paylasimId
        `;
        
        const paylasimResult = await paylasimRequest.query(paylasimQuery);
        
        if (paylasimResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Paylaşım bulunamadı.' });
        }
        
        const paylasim = paylasimResult.recordset[0];

        // 2. Paylaşıma bağlı ilaç, yan etki ve fotoğrafları paralel olarak getir
        const [ilaclarResult, yanetkilerResult, fotograflarResult] = await Promise.all([
            pool.request()
                .input('paylasimId', sql.Int, numericId)
                .query(`
                    SELECT i.id, i.medicine_name, pi.content AS aciklama 
                    FROM PaylasimIlac pi
                    JOIN Ilaclar i ON pi.medicine_id = i.id
                    WHERE pi.paylasim_id = @paylasimId
                `),
            pool.request()
                .input('paylasimId', sql.Int, numericId)
                .query(`
                    SELECT y.id, y.sideeffects_name, py.content AS aciklama
                    FROM PaylasimYanetki py
                    JOIN Yanetkiler y ON py.sideeffects_id = y.id
                    WHERE py.paylasim_id = @paylasimId
                `),
            pool.request()
                .input('paylasimId', sql.Int, numericId)
                .query(`
                    SELECT image FROM Fotograflar 
                    WHERE tur_id = 1 AND gonderi_id = @paylasimId
                `)
        ]);

        // FOTOĞRAF VERİSİNİ BASE64'E ÇEVİRME
        const fotograflar = fotograflarResult.recordset.map(foto => ({
            image: foto.image ? foto.image.toString('base64') : null
        }));

        // 3. Tüm verileri tek bir JSON objesinde birleştirip gönder
        return res.json({
            paylasim: paylasim,
            ilaclar: ilaclarResult.recordset,
            yanetkiler: yanetkilerResult.recordset,
            fotograflar: fotograflar, // FOTOĞRAFLAR EKLENDİ
        });

    } catch (error) {
        console.error('Paylaşım detayı alınırken hata:', error);
        return res.status(500).json({ message: 'Sunucu hatası oluştu.' });
    }
});

app.post('/api/sorusikayet', async (req, res) => {
    try {
        const { soru_id } = req.body;
        if (!soru_id) return res.status(400).json({ message: 'Eksik parametreler.' });

        // Şikayet ana ID'sini al
        const sikayetidRequest = await pool.request().query(`SELECT id FROM SikayetAna WHERE ad = 'Soru'`);
        if(sikayetidRequest.recordset.length===0){
            console.log("alla alla")
        }
        const sikayetid = sikayetidRequest.recordset[0].id;

        // Şikayet ekle
        await pool.request()
          .input('sikayetana_id', sql.Int, parseInt(sikayetid))
          .input('soru_id', sql.Int, parseInt(soru_id))
          .query(`INSERT INTO Sikayetler(sikayet_anaid, sikayet_id, sikayet_tarihi) VALUES (@sikayetana_id, @soru_id, GETDATE())`);

        return res.status(201).json({ message: 'Şikayet başarıyla eklendi.' });
        
    } catch (error) {
        console.error('Soru şikayet edilirken hata:', error);
        return res.status(500).json({ message: 'Şikayet işlemi sırasında bir hata oluştu.' });
    }
});

app.post('/api/paylasimsikayet', async (req, res) => {
    try {
        const { paylasim_id,sikayetid } = req.body;
        if (!paylasim_id) return res.status(400).json({ message: 'Eksik parametreler.' });

        // ad ile bulamıyoruz başka bir yöntem lazım

        // Şikayet ana ID'sini al
        // const sikayetidRequest = await pool.request().query(`SELECT id FROM SikayetAna WHERE ad = 'Paylaşım`);
        // if(sikayetidRequest.recordset.length===0){
        //     console.log("alla alla")
        // }
        

        // Şikayet ekle
        await pool.request()
          .input('sikayetana_id', sql.Int, parseInt(sikayetid))
          .input('paylasim_id', sql.Int, parseInt(paylasim_id))
          .query(`INSERT INTO Sikayetler(sikayet_anaid, sikayet_id, sikayet_tarihi) VALUES (@sikayetana_id, @paylasim_id, GETDATE())`);

        return res.status(201).json({ message: 'Şikayet başarıyla eklendi.' });
        
    } catch (error) {
        console.error('Soru şikayet edilirken hata:', error);
        return res.status(500).json({ message: 'Şikayet işlemi sırasında bir hata oluştu.' });
    }
});

// --- TARTIŞMALARLA İLGİLİ ENDPOINT'LER ---

// 1. TÜM TARTIŞMALARI LİSTELEME
// =================================================================
// TARTIŞMA GET ENDPOINT'LERİ (Optimize Edilmiş ve Doğru Haller)
// =================================================================

// 1. TÜM TARTIŞMALARI LİSTELEME (N+1 Problemi Giderilmiş Hali)
// =================================================================
// TARTIŞMA GET ENDPOINT'LERİ (Optimize Edilmiş ve Doğru Haller)
// =================================================================

// 1. TÜM TARTIŞMALARI LİSTELEME (N+1 Problemi Giderilmiş Hali)
app.get('/api/tartismalar', async (req, res) => {
    try {
        if (!pool || !pool.connected) await connectDB();
        const result = await pool.request().query(`
            WITH YorumCTE AS (
                SELECT 
                    y.id, y.parent_id, y.content, y.date, u.name as user_name,
                    ROW_NUMBER() OVER(PARTITION BY y.parent_id ORDER BY y.date DESC) as rn
                FROM TumYorumlar y
                JOIN Kullanicilar u ON y.user_id = u.id
            )
            SELECT 
                t.*, 
                k.name AS user_name, 
                k.surname AS user_surname,
                ISNULL(r.rol_ad, 'kullanici') AS user_rol, -- Yetkilendirme için rol eklendi
                (SELECT COUNT(*) FROM TumYorumlar WHERE parent_id = 't' + CAST(t.id AS VARCHAR)) AS etkilesim_sayisi,
                (
                    SELECT y.id, y.content, y.user_name
                    FROM YorumCTE y
                    WHERE y.parent_id = 't' + CAST(t.id AS VARCHAR) AND y.rn <= 2
                    FOR JSON PATH
                ) AS onekiYorumlar
            FROM Tartismalar t
            JOIN Kullanicilar k ON t.user_id = k.id
            LEFT JOIN UserRoller ur ON k.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE t.id NOT IN (
                SELECT kaldirma_id FROM Kaldirilanlar WHERE sikayet_anaid = 4
            )
            ORDER BY t.date DESC;
        `);
        
        const tartismalar = result.recordset.map(t => ({
            ...t,
            onekiYorumlar: t.onekiYorumlar ? JSON.parse(t.onekiYorumlar) : []
        }));

        return res.json(tartismalar);

    } catch (err) {
        console.error('❌ Tartışmalar API Hatası:', err);
        return res.status(500).json({ message: 'Tartışmalar alınırken bir hata oluştu.', error: err.message });
    }
});

app.post('/api/tartismaekle', async (req, res) => {
    try {
        const { title, content, user_id } = req.body;

        if (!title || !user_id) {
            return res.status(400).json({ message: 'Başlık ve kullanıcı ID alanları zorunludur.' });
        }
        if (title.trim().length === 0) {
            return res.status(400).json({ message: 'Başlık boş olamaz.' });
        }

        if (!pool || !pool.connected) await connectDB();
        
        const request = pool.request();
        request.input('user_id', sql.Int, user_id);
        request.input('title', sql.NVarChar, title);
        request.input('content', sql.NVarChar, content);

        const result = await request.query(`
            INSERT INTO Tartismalar (user_id, title, content, date)
            OUTPUT INSERTED.*
            VALUES (@user_id, @title, @content, GETDATE());
        `);

        return res.status(201).json(result.recordset[0]);

    } catch (err) {
        console.error('❌ Yeni Tartışma Ekleme API Hatası:', err);
        return res.status(500).json({ message: 'Tartışma oluşturulurken bir hata oluştu.', error: err.message });
    }
});


app.post('/api/hastalikekle', async (req, res) => {
    try {
        const { illness_name, slug } = req.body;

        // Mevcut validation kontrolleri yerinde kalmalı
        if (!illness_name || !slug) {
            return res.status(400).json({ message: 'Hastalık adı ve slug alanları zorunludur.' });
        }
        if (illness_name.trim().length === 0 || slug.trim().length === 0) {
            return res.status(400).json({ message: 'Hastalık adı veya slug boş olamaz.' });
        }

        if (!pool || !pool.connected) await connectDB();
        
        // 1. ADIM: Mevcut kayıt var mı diye kontrol et
        const checkRequest = pool.request();
        checkRequest.input('illness_name_check', sql.NVarChar, illness_name);
        checkRequest.input('slug_check', sql.NVarChar, slug);
        
        const checkResult = await checkRequest.query(`
            SELECT TOP 1 * FROM Hastaliklar 
            WHERE illness_name = @illness_name_check OR slug = @slug_check
        `);

        if (checkResult.recordset.length > 0) {
            // Kayıt zaten mevcutsa, 409 Conflict hatası döndür
            return res.status(409).json({ message: 'Bu hastalık adı veya slug zaten mevcut.' });
        }

        // 2. ADIM: Kayıt yoksa ekleme işlemini yap
        const insertRequest = pool.request();
        insertRequest.input('illness_name', sql.NVarChar, illness_name);
        insertRequest.input('slug', sql.NVarChar, slug);

        const result = await insertRequest.query(`
            INSERT INTO Hastaliklar (illness_name, slug)
            OUTPUT INSERTED.* -- Eklenen kaydı geri döndürmek için
            VALUES (@illness_name, @slug);
        `);

        // Genellikle eklenen yeni kaydın tamamını döndürmek daha iyidir
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
            return res.status(201).json({ message: 'Hastalık başarıyla eklendi.' });
        } else {
            return res.status(500).json({ message: 'Hastalık eklenemedi.' });
        }

    } catch (err) {
        console.error('❌ Yeni Hastalık Ekleme API Hatası:', err);
        // Veritabanındaki UNIQUE constraint hatasını yakalarsak
        if (err.number === 2627 || err.number === 2601) { // SQL Server unique constraint violation error codes
            return res.status(409).json({ message: 'Bu kayıt zaten mevcut (DB Hatası).' });
        }
        return res.status(500).json({ message: 'Hastalık oluşturulurken bir hata oluştu.', error: err.message });
    }
});

app.post('/api/ilacekle', async (req, res) => {
    try {
        const { medicine_name} = req.body;

        if (!medicine_name) {
            return res.status(400).json({ message: 'Başlık ve kullanıcı ID alanları zorunludur.' });
        }
        if (medicine_name.trim().length === 0) {
            return res.status(400).json({ message: 'İlaç adı boş olamaz.' });
        }

        if (!pool || !pool.connected) await connectDB();
        const checkRequest = pool.request();
        checkRequest.input('medicine_name_check', sql.NVarChar, medicine_name);
        
        const checkResult = await checkRequest.query(`
            SELECT TOP 1 * FROM Ilaclar 
            WHERE medicine_name = @medicine_name_check 
        `);

        if (checkResult.recordset.length > 0) {
            // Kayıt zaten mevcutsa, 409 Conflict hatası döndür
            return res.status(409).json({ message: 'Bu ilaç zaten mevcut.' });
        }


        const request = pool.request();
        request.input('medicine_name', sql.NVarChar, medicine_name);

        const result = await request.query(`
            INSERT INTO Ilaclar (medicine_name)
            VALUES (@medicine_name);
        `);

        if (result.rowsAffected && result.rowsAffected[0] > 0) {
            return res.status(201).json({ message: 'İlaç başarıyla eklendi.' });
        } else {
            return res.status(500).json({ message: 'İlaç eklenemedi.' });
        }

    } catch (err) {
        console.error('❌ Yeni İlaç Ekleme API Hatası:', err);
        return res.status(500).json({ message: 'İlaç oluşturulurken bir hata oluştu.', error: err.message });
    }
});

app.post('/api/yanetkiekle', async (req, res) => {
    try {
        const { sideeffects_name} = req.body;

        if (!sideeffects_name) {
            return res.status(400).json({ message: 'Başlık ve kullanıcı ID alanları zorunludur.' });
        }
        if (sideeffects_name.trim().length === 0) {
            return res.status(400).json({ message: 'İlaç adı boş olamaz.' });
        }

        if (!pool || !pool.connected) await connectDB();
        const checkRequest = pool.request();
        checkRequest.input('sideeffects_name_check', sql.NVarChar, sideeffects_name);
        
        const checkResult = await checkRequest.query(`
            SELECT TOP 1 * FROM Yanetkiler 
            WHERE sideeffects_name = @sideeffects_name_check 
        `);

        if (checkResult.recordset.length > 0) {
            // Kayıt zaten mevcutsa, 409 Conflict hatası döndür
            return res.status(409).json({ message: 'Bu Yanetki zaten mevcut.' });
        }


        const request = pool.request();
        request.input('sideeffects_name', sql.NVarChar, sideeffects_name);

        const result = await request.query(`
            INSERT INTO Yanetkiler (sideeffects_name)
            VALUES (@sideeffects_name);
        `);

        if (result.rowsAffected && result.rowsAffected[0] > 0) {
            return res.status(201).json({ message: 'Yanetki başarıyla eklendi.' });
        } else {
            return res.status(500).json({ message: 'Yanetki eklenemedi.' });
        }

    } catch (err) {
        console.error('❌ Yeni Yanetki Ekleme API Hatası:', err);
        return res.status(500).json({ message: 'Yanetki oluşturulurken bir hata oluştu.', error: err.message });
    }
});


// 2. TARTIŞMA DETAYINI GETİRME (Kullanıcı Rolleri Eklenmiş Hali)
app.get('/api/tartismalar/:id', async (req, res) => {
    try {
        if (!pool || !pool.connected) await connectDB();
        const { id } = req.params;
        const tartismaId = parseInt(id);
        if (isNaN(tartismaId)) {
            return res.status(400).json({ message: 'Geçersiz ID formatı.' });
        }

        const tartismaRequest = pool.request();
        tartismaRequest.input('id', sql.Int, tartismaId);
        const tartismaResult = await tartismaRequest.query(`
            SELECT 
                t.*, 
                u.name as user_name, 
                u.surname as user_surname,
                ISNULL(r.rol_ad, 'kullanici') AS user_rol
            FROM Tartismalar t
            JOIN Kullanicilar u ON t.user_id = u.id
            LEFT JOIN UserRoller ur ON u.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE t.id = @id
        `);

        if (tartismaResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Tartışma bulunamadı.' });
        }
        
        const yorumlarRequest = pool.request();
        yorumlarRequest.input('tartismaIdStr', sql.NVarChar, 't' + tartismaId);
        const yorumlarResult = await yorumlarRequest.query(`
            WITH CommentHierarchy AS (
                SELECT *, 0 AS level FROM TumYorumlar WHERE parent_id = @tartismaIdStr
                UNION ALL
                SELECT c.*, ch.level + 1 FROM TumYorumlar c
                INNER JOIN CommentHierarchy ch ON c.parent_id = CAST(ch.id AS NVARCHAR(20))
                WHERE ch.level < 15
            )
            SELECT 
                ch.*, 
                u.name as user_name, u.surname as user_surname, 
                ISNULL(r.rol_ad, 'kullanici') AS user_rol 
            FROM CommentHierarchy ch
            JOIN Kullanicilar u ON ch.user_id = u.id
            LEFT JOIN UserRoller ur ON u.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id;
        `);
        
        const kaldirilanResult = await pool.request()
            .query(`SELECT kaldirma_id FROM Kaldirilanlar WHERE sikayet_anaid = 5`);
        
        const kaldirilanYorumIdleri = kaldirilanResult.recordset.map(r => r.kaldirma_id);

        return res.json({
            tartisma: tartismaResult.recordset[0],
            yorumlar: yorumlarResult.recordset,
            kaldirilanYorumIdleri: kaldirilanYorumIdleri
        });

    } catch (err) {
        console.error('❌ Tartışma Detay API Hatası:', err);
        return res.status(500).json({ message: 'Tartışma detayı alınırken bir hata oluştu.', error: err.message });
    }
});

// =================================================================
// TARTIŞMA POST/DELETE ENDPOINT'LERİ (Düzeltilmiş Haller)
// =================================================================

// 3. YENİ TARTIŞMA YORUMU EKLEME 
app.post('/api/tartismayorum', async (req, res) => {
    try {
        const { content, parent_id, user_id } = req.body;
        if (!content || !parent_id || !user_id) {
            return res.status(400).json({ message: 'Eksik parametreler: content, parent_id ve user_id gereklidir.' });
        }
        if (!pool || !pool.connected) await connectDB();
        
        const request = pool.request();
        request.input('parent_id', sql.NVarChar, parent_id);
        request.input('user_id', sql.Int, user_id);
        request.input('content', sql.NVarChar, content);
        const result = await request.query(`
            INSERT INTO TumYorumlar (parent_id, user_id, content, date)
            OUTPUT INSERTED.*
            VALUES (@parent_id, @user_id, @content, GETDATE());
        `);

        return res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error('❌ Tartışma Yorum Ekleme API Hatası:', err);
        return res.status(500).json({ message: 'Yorum eklenirken bir hata oluştu.', error: err.message });
    }
});


// 4. TARTIŞMA ŞİKAYET ETME 
app.post('/api/tartismasikayet', async (req, res) => {
    try {
        const { tartisma_id } = req.body;
        
        if (!tartisma_id) {
            return res.status(400).json({ message: 'Eksik parametre: tartisma_id gereklidir.' });
        }
        
        if (!pool || !pool.connected) await connectDB();
        
        const request = pool.request();
        request.input('tartisma_id', sql.Int, tartisma_id);
        request.input('sikayet_anaid', sql.Int, 4); // 4 = Tartışma
        await request.query(`
            INSERT INTO Sikayetler (sikayet_anaid, sikayet_id, sikayet_tarihi)
            VALUES (@sikayet_anaid, @tartisma_id, GETDATE())
        `);
        
        return res.json({ message: 'Tartışma şikayetiniz alındı ve incelenecektir.' });
        
    } catch (error) {
        console.error('Tartışma şikayet edilirken hata:', error);
        return res.status(500).json({ message: 'Şikayet işlemi sırasında bir hata oluştu.' });
    }
});

// 5. TARTIŞMA YORUMU ŞİKAYET ETME
app.post('/api/tartismayorumsikayet', async (req, res) => {
    try {
        const { yorum_id } = req.body;
        if (!yorum_id) {
            return res.status(400).json({ message: 'Eksik parametreler.' });
        }
        if (!pool || !pool.connected) await connectDB();
        
        const request = pool.request();
        request.input('yorum_id', sql.Int, yorum_id);
        request.input('sikayet_anaid', sql.Int, 5); // 5 = Tartışma Yorumu
        await request.query(`
            INSERT INTO Sikayetler (sikayet_anaid,sikayet_id, sikayet_tarihi)
            VALUES (@sikayet_anaid, @yorum_id,GETDATE())
        `);
        
        return res.json({ message: 'Yorum şikayetiniz alındı ve incelenecektir.' });
    } catch (error) {
        console.error('Yorum şikayet edilirken hata:', error);
        return res.status(500).json({ message: 'Şikayet işlemi sırasında bir hata oluştu.' });
    }
});

// 6. TARTIŞMA KALDIRMA
app.delete('/api/tartismakaldir/:tartismaId', async (req, res) => {
    // GÜVENLİK NOTU: kaldiran_id ve kaldiran_rol bilgileri,
    // güvendiğiniz bir kaynaktan (JWT'den gelen req.user gibi) alınmalıdır.
    // Şimdilik req.body'den almaya devam ediyoruz.
    const { kaldiran_id, kaldiran_rol } = req.body;
    const { tartismaId } = req.params;
    
    // --- Girdi Kontrolleri ---
    const numerictartismaId = parseInt(tartismaId);
    const numericKaldiranId = parseInt(kaldiran_id);
    if (isNaN(numerictartismaId) || isNaN(numericKaldiranId) || !kaldiran_rol) {
        return res.status(400).json({ message: 'Geçersiz veya eksik parametreler.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        if (!pool || !pool.connected) await connectDB();
        
        // --- 1. Adım: Tartışmayı ve Sahibinin Rolünü Veritabanından Çek ---
        const tartismaRequest = pool.request();
        tartismaRequest.input('tartismaId', sql.Int, numerictartismaId);
        const tartismaResult = await tartismaRequest.query(`
            SELECT 
                t.id,
                t.user_id,
                ISNULL(r.rol_ad, 'kullanici') as sahip_rol
            FROM Tartismalar t
            JOIN Kullanicilar k ON t.user_id = k.id
            LEFT JOIN UserRoller ur ON k.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE t.id = @tartismaId
        `);

        if (tartismaResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Tartışma bulunamadı.' });
        }
        const tartisma = tartismaResult.recordset[0];

        // --- 2. Adım: Yetki Kontrolü ---
        const isOwner = numericKaldiranId === tartisma.user_id;
        const isAdmin = kaldiran_rol === 'admin';
        const isModerator = kaldiran_rol === 'moderator';
        const ownerIsAdmin = tartisma.sahip_rol === 'admin';

        // --- 3. Adım: Mantığa Göre Silme İşlemini Uygula ---

        // SENARYO 1: Silmek isteyen kişi tartışmanın sahibi.
        if (isOwner) {
            // KALICI SİLME (HARD DELETE) İŞLEMİ
            await transaction.begin();
            
            const request = new sql.Request(transaction);
            request.input('tartismaId', sql.Int, numerictartismaId);
            const parentIdPrefix = 't' + numerictartismaId;
            
            // Bu tartışmaya ait tüm yorumları (ve cevaplarını) bulmak için bir CTE kullanıyoruz.
            const yorumIdsResult = await request.query(`
                WITH CommentTree AS (
                    SELECT id FROM TumYorumlar WHERE parent_id = '${parentIdPrefix}'
                    UNION ALL
                    SELECT c.id FROM TumYorumlar c JOIN CommentTree ct ON c.parent_id = CAST(ct.id AS VARCHAR)
                )
                SELECT id FROM CommentTree;
            `);

            const yorumIdsToDelete = yorumIdsResult.recordset.map(r => r.id);

            if (yorumIdsToDelete.length > 0) {
                // Bulunan tüm yorumları tek seferde sil
                await request.query(`DELETE FROM TumYorumlar WHERE id IN (${yorumIdsToDelete.join(',')})`);
            }
            
            // Son olarak tartışmanın kendisini sil
            await request.query(`DELETE FROM Tartismalar WHERE id = @tartismaId`);

            await transaction.commit();
            return res.json({ message: 'Tartışmanız ve ilgili tüm yorumlar kalıcı olarak silindi.' });
        }

        // SENARYO 2: Silmek isteyen kişi admin veya moderatör (ama tartışmanın sahibi değil).
        const canSoftDelete = (isAdmin && !ownerIsAdmin) || (isModerator && !ownerIsAdmin);
        if (canSoftDelete) {
            // SADECE GİZLEME (SOFT DELETE) İŞLEMİ
            const kaldirRequest = pool.request();
            kaldirRequest.input('kaldirma_id', sql.Int, numerictartismaId);
            kaldirRequest.input('kaldiran_id', sql.Int, numericKaldiranId);
            kaldirRequest.input('sikayet_anaid', sql.Int, 4); // 4 = Tartışmalar için
            
            await kaldirRequest.query(`
                INSERT INTO Kaldirilanlar (sikayet_anaid, kaldirma_id, kaldiran_id, kaldirma_tarihi)
                VALUES (@sikayet_anaid, @kaldirma_id, @kaldiran_id, GETDATE())
            `);
            
            return res.json({ message: 'Tartışma başarıyla kaldırıldı ve arşivlendi.' });
        }

        // SENARYO 3: Yetkisiz erişim.
        return res.status(403).json({ message: 'Bu tartışmayı silme yetkiniz bulunmamaktadır.' });
        
    } catch (error) {
        if (transaction && transaction.active) {
            await transaction.rollback(); // Hata durumunda işlemi geri al
        }
        console.error('Tartışma silinirken hata:', error);
        return res.status(500).json({ message: 'Tartışma silinirken bir sunucu hatası oluştu.' });
    }
});

// 7. TARTIŞMA YORUMU KALDIRMA 
app.delete('/api/tartismayorumkaldir/:yorumId', async (req, res) => {
    // GÜVENLİK NOTU: kaldiran_id ve kaldiran_rol bilgileri,
    // güvendiğiniz bir kaynaktan (JWT'den gelen req.user gibi) alınmalıdır.
    // Şimdilik req.body'den almaya devam ediyoruz.
    const { kaldiran_id, kaldiran_rol } = req.body;
    const { yorumId } = req.params;
    
    // --- Girdi Kontrolleri ---
    const numericyorumId = parseInt(yorumId);
    const numericKaldiranId = parseInt(kaldiran_id);
    if (isNaN(numericyorumId) || isNaN(numericKaldiranId) || !kaldiran_rol) {
        return res.status(400).json({ message: 'Geçersiz veya eksik parametreler.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        if (!pool || !pool.connected) await connectDB();
        
        // --- 1. Adım: Yorumu ve Sahibinin Rolünü Veritabanından Çek ---
        const yorumRequest = pool.request();
        yorumRequest.input('yorumId', sql.Int, numericyorumId);
        const yorumResult = await yorumRequest.query(`
            SELECT 
                y.id,
                y.user_id,
                ISNULL(r.rol_ad, 'kullanici') as sahip_rol
            FROM TumYorumlar y
            JOIN Kullanicilar k ON y.user_id = k.id
            LEFT JOIN UserRoller ur ON k.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE y.id = @yorumId
        `);

        if (yorumResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Yorum bulunamadı.' });
        }
        const yorum = yorumResult.recordset[0];

        // --- 2. Adım: Yetki Kontrolü ---
        const isOwner = numericKaldiranId === yorum.user_id;
        const isAdmin = kaldiran_rol === 'admin';
        const isModerator = kaldiran_rol === 'moderator';
        const ownerIsAdmin = yorum.sahip_rol === 'admin';

        // --- 3. Adım: Mantığa Göre Silme İşlemini Uygula ---

        // SENARYO 1: Silmek isteyen kişi yorumun sahibi.
        if (isOwner) {
            // KALICI SİLME (HARD DELETE) İŞLEMİ
            await transaction.begin();
            
            const request = new sql.Request(transaction);
            request.input('yorumId', sql.Int, numericyorumId);

            // Silinecek ana yorumu ve tüm alt cevaplarını bulmak için Recursive CTE kullanıyoruz.
            const deleteQuery = `
                WITH CommentTree AS (
                    -- Başlangıç noktası: Silinmek istenen yorum
                    SELECT id FROM TumYorumlar WHERE id = @yorumId
                    
                    UNION ALL
                    
                    -- Tekrarlayan kısım: Ağaçtaki yorumların çocuklarını bul
                    SELECT c.id FROM TumYorumlar c JOIN CommentTree ct ON c.parent_id = CAST(ct.id AS VARCHAR(20))
                )
                -- Ağaçtaki tüm yorumları sil
                DELETE FROM TumYorumlar WHERE id IN (SELECT id FROM CommentTree);
            `;
            
            await request.query(deleteQuery);
            await transaction.commit();

            return res.json({ message: 'Yorumunuz ve ilgili tüm cevaplar kalıcı olarak silindi.' });
        }

        // SENARYO 2: Silmek isteyen kişi admin veya moderatör (ama yorumun sahibi değil).
        const canSoftDelete = (isAdmin && !ownerIsAdmin) || (isModerator && !ownerIsAdmin);
        if (canSoftDelete) {
            // SADECE GİZLEME (SOFT DELETE) İŞLEMİ
            const kaldirRequest = pool.request();
            kaldirRequest.input('kaldirma_id', sql.Int, numericyorumId);
            kaldirRequest.input('kaldiran_id', sql.Int, numericKaldiranId);
            kaldirRequest.input('sikayet_anaid', sql.Int, 5); // 5 = Tartışma Yorumları için
            
            await kaldirRequest.query(`
                INSERT INTO Kaldirilanlar (sikayet_anaid, kaldirma_id, kaldiran_id, kaldirma_tarihi)
                VALUES (@sikayet_anaid, @kaldirma_id, @kaldiran_id, GETDATE())
            `);
            
            return res.json({ message: 'Yorum başarıyla kaldırıldı ve arşivlendi.' });
        }

        // SENARYO 3: Yetkisiz erişim.
        return res.status(403).json({ message: 'Bu yorumu silme yetkiniz bulunmamaktadır.' });
        
    } catch (error) {
        if (transaction && transaction.active) {
            await transaction.rollback(); // Hata durumunda işlemi geri al
        }
        console.error('Yorum silinirken hata:', error);
        return res.status(500).json({ message: 'Yorum silinirken bir sunucu hatası oluştu.' });
    }
});
// --- YÖNETİM PANELİ İÇİN API ENDPOINT'LERİ ---

// 1. PANELİN TÜM VERİLERİNİ TEK SEFERDE GETİREN ENDPOINT
// 1. PANELİN TÜM VERİLERİNİ TEK SEFERDE GETİREN ENDPOINT (GÜNCELLENMİŞ)
app.get('/api/admin/panel-data', async (req, res) => {
    try {
        if (!pool || !pool.connected) await connectDB();

        const [sikayetlerResult, kaldirilanlarResult] = await Promise.all([
            // --- DÜZELTİLMİŞ ŞİKAYETLER SORGUSU ---
            pool.request().query(`
                WITH CommentHierarchy AS (
                    -- 1. BAŞLANGIÇ NOKTASI (ANCHOR): Değişiklik yok, aynı kalıyor.
                    SELECT 
                        s.id AS sikayet_id,
                        COALESCE(byorum.parent_id, tyorum.parent_id) AS parent_id
                    FROM 
                        Sikayetler s
                    LEFT JOIN ButunYorumlar byorum ON s.sikayet_anaid = 3 AND s.sikayet_id = byorum.id
                    LEFT JOIN TumYorumlar tyorum ON s.sikayet_anaid = 5 AND s.sikayet_id = tyorum.id
                    WHERE 
                        s.sikayet_anaid IN (3, 5)

                    UNION ALL

                    -- 2. TEKRARLAYAN KISIM (RECURSIVE): DÜZELTME BURADA YAPILDI
                    -- LEFT JOIN yerine iki ayrı INNER JOIN bloğu kullanıyoruz.
                    -- İlk blok ButunYorumlar tablosunda bir üst ebeveyni arar.
                    SELECT 
                        ch.sikayet_id,
                        byorum.parent_id
                    FROM 
                        CommentHierarchy ch
                    INNER JOIN ButunYorumlar byorum ON CAST(byorum.id AS VARCHAR(MAX)) = ch.parent_id
                    WHERE
                        ISNUMERIC(ch.parent_id) = 1

                    UNION ALL

                    -- İkinci blok TumYorumlar tablosunda bir üst ebeveyni arar.
                    SELECT 
                        ch.sikayet_id,
                        tyorum.parent_id
                    FROM 
                        CommentHierarchy ch
                    INNER JOIN TumYorumlar tyorum ON CAST(tyorum.id AS VARCHAR(MAX)) = ch.parent_id
                    WHERE
                        ISNUMERIC(ch.parent_id) = 1
                ),
                -- 3. SONUÇ: Değişiklik yok, aynı kalıyor.
                RootParents AS (
                    SELECT 
                        sikayet_id, 
                        parent_id AS ana_konu_id
                    FROM 
                        CommentHierarchy
                    WHERE 
                        ISNUMERIC(parent_id) = 0
                )
                -- 4. ANA SORGULAMA: Değişiklik yok, aynı kalıyor.
                SELECT 
                    s.id as sikayet_id, 
                    s.sikayet_anaid, 
                    s.sikayet_id as icerik_id, 
                    s.sikayet_tarihi,
                    sa.ad as tur,
                    rp.ana_konu_id,
                    COALESCE(p.title, q.title, t.title, SUBSTRING(tum_y.content, 1, 40) + '...', SUBSTRING(butun_y.content, 1, 40) + '...') as baslik,
                    COALESCE(p.content, q.content, t.content, tum_y.content, butun_y.content) as icerik,
                    COALESCE(p.user_id, q.user_id, t.user_id, tum_y.user_id, butun_y.user_id) as icerik_sahibi_id,
                    icerik_sahibi.name as icerik_sahibi_adi
                FROM 
                    Sikayetler s
                JOIN SikayetAna sa ON s.sikayet_anaid = sa.id
                LEFT JOIN RootParents rp ON s.id = rp.sikayet_id
                LEFT JOIN Paylasimlar p ON s.sikayet_anaid = 1 AND s.sikayet_id = p.id
                LEFT JOIN ButunSorular q ON s.sikayet_anaid = 2 AND s.sikayet_id = q.id
                LEFT JOIN ButunYorumlar butun_y ON s.sikayet_anaid = 3 AND s.sikayet_id = butun_y.id
                LEFT JOIN Tartismalar t ON s.sikayet_anaid = 4 AND s.sikayet_id = t.id
                LEFT JOIN TumYorumlar tum_y ON s.sikayet_anaid = 5 AND s.sikayet_id = tum_y.id
                LEFT JOIN Kullanicilar icerik_sahibi ON icerik_sahibi.id = COALESCE(p.user_id, q.user_id, t.user_id, tum_y.user_id, butun_y.user_id)
                ORDER BY 
                    s.sikayet_tarihi DESC;
            `),
            // Kaldırılanlar sorgusu olduğu gibi kalıyor.
            pool.request().query(`
                SELECT 
                    k.id as kaldirma_pk_id, k.sikayet_anaid, k.kaldirma_id as icerik_id, k.kaldiran_id, k.kaldirma_tarihi,
                    sa.ad as tur,
                    COALESCE(p.title, q.title, t.title, SUBSTRING(tum_y.content, 1, 40) + '...', SUBSTRING(butun_y.content, 1, 40) + '...') as baslik,
                    COALESCE(p.content, q.content, t.content, tum_y.content, butun_y.content) as icerik,
                    COALESCE(p.user_id, q.user_id, t.user_id, tum_y.user_id, butun_y.user_id) as icerik_sahibi_id,
                    icerik_sahibi.name as icerik_sahibi_adi,
                    icerik_sahibi.surname as icerik_sahibi_soyadi,
                    kaldiran.name as kaldiran_adi,
                    kaldiran.surname as kaldiran_soyadi
                FROM Kaldirilanlar k
                JOIN SikayetAna sa ON k.sikayet_anaid = sa.id
                LEFT JOIN Kullanicilar kaldiran ON k.kaldiran_id = kaldiran.id
                LEFT JOIN Paylasimlar p ON k.sikayet_anaid = 1 AND k.kaldirma_id = p.id
                LEFT JOIN ButunSorular q ON k.sikayet_anaid = 2 AND k.kaldirma_id = q.id
                LEFT JOIN ButunYorumlar butun_y ON k.sikayet_anaid = 3 AND k.kaldirma_id = butun_y.id
                LEFT JOIN Tartismalar t ON k.sikayet_anaid = 4 AND k.kaldirma_id = t.id
                LEFT JOIN TumYorumlar tum_y ON k.sikayet_anaid = 5 AND k.kaldirma_id = tum_y.id
                LEFT JOIN Kullanicilar icerik_sahibi ON icerik_sahibi.id = COALESCE(p.user_id, q.user_id, t.user_id, tum_y.user_id, butun_y.user_id)
                ORDER BY k.kaldirma_tarihi DESC
            `)
        ]);

        return res.json({
            sikayetler: sikayetlerResult.recordset,
            kaldirilanlar: kaldirilanlarResult.recordset
        });

    } catch (err) {
        console.error('❌ Admin Panel Veri Çekme Hatası:', err);
        return res.status(500).json({ message: 'Panel verileri alınırken bir hata oluştu.' });
    }
});

// src/index.js (veya ana server dosyanız)

// Ban İtirazlarını listeleme
app.get('/api/admin/ban-itirazlari', async (req, res) => {
    try {
        if (!pool || !pool.connected) await connectDB();
        
        const request = pool.request();
        const result = await request.query(`
            SELECT
                bi.id,
                bi.user_id,
                bi.content,
                bi.date,
                u.name AS user_name,
                u.surname AS user_surname,
                CASE WHEN bic.ban_id IS NOT NULL THEN 1 ELSE 0 END AS cevaplanmis
            FROM Banitiraz bi
            JOIN Kullanicilar u ON bi.user_id = u.id
            LEFT JOIN Banitirazcevap bic ON bi.id = bic.ban_id
            ORDER BY bi.date DESC
        `);

        return res.json(result.recordset);

    } catch (hata) {
        console.error('Ban itirazları listeleme hatası:', hata);
        return res.status(500).json({ message: 'Sunucu hatası oluştu.' });
    }
});

// Ban İtirazı detay ve cevaplarını getirme
app.get('/api/admin/ban-itirazlari/:itirazId', async (req, res) => {
    try {
        const { itirazId } = req.params;
        const numericId = parseInt(itirazId);

        if (isNaN(numericId)) {
            return res.status(400).json({ message: 'Geçersiz itiraz ID formatı.' });
        }

        if (!pool || !pool.connected) await connectDB();

        const request = pool.request();
        request.input('banId', sql.Int, numericId);

        const result = await request.query(`
            SELECT
                bic.id,
                bic.user_id,
                bic.content,
                bic.date,
                bic.status,
                u.name AS user_name,
                u.surname AS user_surname
            FROM Banitirazcevap bic
            JOIN Kullanicilar u ON bic.user_id = u.id
            WHERE bic.ban_id = @banId
            ORDER BY bic.date ASC
        `);

        return res.json(result.recordset);

    } catch (hata) {
        console.error('Ban itirazı detay hatası:', hata);
        return res.status(500).json({ message: 'Sunucu hatası oluştu.' });
    }
});


// Ban İtirazını cevaplama
app.post('/api/admin/ban-itiraz-cevapla', async (req, res) => {
    const transaction = new sql.Transaction(pool);
    try {
        const { ban_id, user_id, content, status } = req.body;
        
        if (!ban_id || !user_id || !content || status === undefined) {
            return res.status(400).json({ message: 'Eksik veya geçersiz cevap bilgisi.' });
        }
        
        await transaction.begin();
        
        // Cevabı Banitirazcevap tablosuna ekle
        const cevapRequest = new sql.Request(transaction);
        cevapRequest.input('ban_id', sql.Int, ban_id);
        cevapRequest.input('user_id', sql.Int, user_id);
        cevapRequest.input('content', sql.NVarChar, content);
        cevapRequest.input('status', sql.Int, status); // 0: Red, 1: Kabul

        await cevapRequest.query(`
            INSERT INTO Banitirazcevap (ban_id, user_id, content, date, status)
            VALUES (@ban_id, @user_id, @content, GETDATE(), @status)
        `);

        // İtirazı cevaplandı olarak işaretle (durumu güncelle)
        // Düzeltme: Banitiraz tablosunda status olmadığı için bu kısım iptal edildi.
        // İtirazın durumunu Banitirazcevap tablosundan yola çıkarak frontend'de belirleyeceğiz.
        
        await transaction.commit();
        
        return res.status(201).json({ message: 'Cevabınız başarıyla gönderildi.' });
        
    } catch (hata) {
        await transaction.rollback();
        console.error('Ban itirazı cevaplama hatası:', hata);
        return res.status(500).json({ message: 'Sunucu hatası oluştu.' });
    }
});

// 2. ŞİKAYET EDİLEN BİR İÇERİĞİ KALDIRAN ENDPOINT
app.post('/api/admin/icerik-kaldir', async (req, res) => {
    const { sikayet, kaldiran_id } = req.body;
    const transaction = new sql.Transaction(pool);
    try {
        if (!sikayet || !kaldiran_id) {
            return res.status(400).json({ message: 'Eksik parametreler.' });
        }
        if (!pool || !pool.connected) await connectDB();

        await transaction.begin();

        // Adım 1: İçeriği 'Kaldirilanlar' tablosuna ekle
        const kaldirRequest = new sql.Request(transaction);
        kaldirRequest.input('sikayet_anaid', sql.Int, sikayet.sikayet_anaid);
        kaldirRequest.input('kaldirma_id', sql.Int, sikayet.icerik_id);
        kaldirRequest.input('kaldiran_id', sql.Int, kaldiran_id);
        await kaldirRequest.query(`
            INSERT INTO Kaldirilanlar (sikayet_anaid, kaldirma_id, kaldiran_id, kaldirma_tarihi)
            VALUES (@sikayet_anaid, @kaldirma_id, @kaldiran_id, GETDATE())
        `);

        // Adım 2: Şikayeti 'Sikayetler' tablosundan sil
        const silRequest = new sql.Request(transaction);
        silRequest.input('sikayet_id', sql.Int, sikayet.sikayet_id);
        await silRequest.query('DELETE FROM Sikayetler WHERE id = @sikayet_id');
        
        await transaction.commit();
        return res.status(200).json({ message: 'İçerik kaldırıldı ve şikayet kapatıldı.' });

    } catch (err) {
        await transaction.rollback();
        console.error('❌ İçerik Kaldırma Hatası:', err);
        return res.status(500).json({ message: 'İçerik kaldırılırken bir hata oluştu.' });
    }
});


// 3. BİR ŞİKAYETİ GEÇERSİZ SAYIP KALDIRAN ENDPOINT
app.delete('/api/admin/sikayet/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!pool || !pool.connected) await connectDB();
        
        const request = pool.request();
        request.input('id', sql.Int, id);
        await request.query('DELETE FROM Sikayetler WHERE id = @id');

        return res.status(200).json({ message: 'Şikayet başarıyla kaldırıldı.' });
    } catch (err) {
        console.error('❌ Şikayet Silme Hatası:', err);
        return res.status(500).json({ message: 'Şikayet silinirken bir hata oluştu.' });
    }
});

// 4. KALDIRILMIŞ BİR İÇERİĞİ GERİ ALAN ENDPOINT
app.delete('/api/admin/icerik-geri-al/:id', async (req, res) => {
    try {
        const { id } = req.params; // Bu ID, Kaldirilanlar tablosunun kendi primary key'i (kaldirma_pk_id)
        if (!pool || !pool.connected) await connectDB();
        
        const request = pool.request();
        request.input('id', sql.Int, id);
        await request.query('DELETE FROM Kaldirilanlar WHERE id = @id');

        return res.status(200).json({ message: 'İçerik başarıyla geri alındı.' });
    } catch (err) {
        console.error('❌ İçerik Geri Alma Hatası:', err);
        return res.status(500).json({ message: 'İçerik geri alınırken bir hata oluştu.' });
    }
});

app.post('/api/admin/kullanici-banla', async (req, res) => {
    try {
        const { user_id, banlayan_id, sebep } = req.body;

        if (!user_id || !banlayan_id || !sebep || sebep.trim() === '') {
            return res.status(400).json({ message: 'Tüm alanlar (kullanıcı ID, banlayan ID, sebep) zorunludur.' });
        }
        
        if (!pool || !pool.connected) await connectDB();

        // 1. ADIM: Banlanacak kullanıcının rolünü ve diğer bilgilerini al
        const userToBanRequest = pool.request();
        userToBanRequest.input('userId', sql.Int, user_id);
        const userToBanResult = await userToBanRequest.query(`
            SELECT k.username, k.email, ISNULL(r.rol_ad, 'kullanici') AS rol 
            FROM Kullanicilar k
            LEFT JOIN UserRoller ur ON k.id = ur.user_id
            LEFT JOIN Roller r ON ur.rol_id = r.id
            WHERE k.id = @userId
        `);

        // Kullanıcı bulunamazsa hata dön
        if (userToBanResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Banlanacak kullanıcı bulunamadı.' });
        }
        
        const user = userToBanResult.recordset[0];
        
        // 2. ADIM: Güvenlik kontrolü (Admin banlamasını engelle)
        if (user.rol === 'admin') {
            return res.status(403).json({ message: 'Admin yetkisine sahip bir kullanıcı banlanamaz.' });
        }

        // 3. ADIM: BanlananKullanicilar tablosuna yeni kaydı ekle
        const banRequest = pool.request();
        banRequest.input('user_id', sql.Int, user_id);
        banRequest.input('banlayan_id', sql.Int, banlayan_id);
        banRequest.input('sebep', sql.NVarChar, sebep.trim());
        
        await banRequest.query(`
            INSERT INTO BanlananKullanicilar (user_id, banlayan_id, sebep, ban_tarihi)
            VALUES (@user_id, @banlayan_id, @sebep, GETDATE());
        `);
        
        // 4. ADIM: Kullanıcıya banlandığına dair e-posta gönder
        await sendBanEmail(user.username, user.email, sebep.trim());

        return res.status(201).json({ message: 'Kullanıcı başarıyla banlandı.' });

    } catch (err) {
        console.error('❌ Kullanıcı Banlama API Hatası:', err);
        return res.status(500).json({ message: 'Kullanıcı banlanırken bir sunucu hatası oluştu.', error: err.message });
    }
});
// YENİ: KULLANICIYA UYARI VERME VE OTOMATİK BAN KONTROLÜ
app.post('/api/admin/kullanici-uyar', async (req, res) => {
    const { user_id, uyari_yapan_id, sebep } = req.body;

    if (!user_id || !uyari_yapan_id || !sebep || sebep.trim() === '') {
        return res.status(400).json({ message: 'Tüm alanlar zorunludur.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        if (!pool || !pool.connected) await connectDB();
        await transaction.begin();

        // 1. ADIM: Yeni uyarıyı veritabanına ekle
        const uyariRequest = new sql.Request(transaction);
        uyariRequest.input('user_id', sql.Int, user_id);
        uyariRequest.input('uyari_yapan_id', sql.Int, uyari_yapan_id);
        uyariRequest.input('sebep', sql.NVarChar, sebep);
        await uyariRequest.query(`
            INSERT INTO Uyari (user_id, uyari_yapan_id, sebep, tarih)
            VALUES (@user_id, @uyari_yapan_id, @sebep, GETDATE())
        `);

        // 2. ADIM: Kullanıcının son 30 gün ve 1 yıldaki uyarı sayılarını ve ilk uyarı tarihini kontrol et
        const checkRequest = new sql.Request(transaction);
        checkRequest.input('userId', sql.Int, user_id);
        const countResult = await checkRequest.query(`
            SELECT
                (SELECT COUNT(*) FROM Uyari WHERE user_id = @userId AND tarih >= DATEADD(day, -30, GETDATE())) as Son30GunUyariSayisi,
                (SELECT COUNT(*) FROM Uyari WHERE user_id = @userId AND tarih >= DATEADD(year, -1, GETDATE())) as Son1YilUyariSayisi,
                (SELECT COUNT(*) FROM BanlananKullanicilar WHERE user_id = @userId) as MevcutBanSayisi,
                (SELECT MIN(tarih) FROM Uyari WHERE user_id = @userId AND tarih >= DATEADD(day, -30, GETDATE())) as IlkUyariTarihiSon30Gun
        `);

        const { Son30GunUyariSayisi, Son1YilUyariSayisi, MevcutBanSayisi, IlkUyariTarihiSon30Gun } = countResult.recordset[0];

        let banTriggered = false;
        // 3. ADIM: Ban koşulları sağlanıyor mu ve kullanıcı zaten banlı değil mi diye bak
        // 30 gün kuralı veya 1 yıl kuralı geçerliyse banla
        if (MevcutBanSayisi === 0 && (Son30GunUyariSayisi >= 3 || Son1YilUyariSayisi >= 30)) {
            banTriggered = true;
            const banRequest = new sql.Request(transaction);
            banRequest.input('user_id', sql.Int, user_id);
            banRequest.input('banlayan_id', sql.Int, 1);
            banRequest.input('sebep', sql.NVarChar, 'Sistem tarafından otomatik banlandı: Çok sayıda uyarı alma.');
            await banRequest.query(`
                INSERT INTO BanlananKullanicilar (user_id, banlayan_id, sebep)
                VALUES (@user_id, @banlayan_id, @sebep)
            `);
        }

        // 4. ADIM: E-posta gönderim için kullanıcı bilgilerini al
        const userRequest = new sql.Request(transaction);
        userRequest.input('userId', sql.Int, user_id);
        const userResult = await userRequest.query(`SELECT username, email FROM Kullanicilar WHERE id = @userId`);
        const user = userResult.recordset[0];

        // 5. ADIM: Commit ve E-posta Gönderimi
        await transaction.commit();

        if (user && !banTriggered && Son30GunUyariSayisi < 3) {
            // Son 30 gün içinde banlanma eşiği aşılmadıysa e-posta gönder
            const nextBanDate = new Date(IlkUyariTarihiSon30Gun);
            nextBanDate.setDate(nextBanDate.getDate() + 30);
            const formattedDate = nextBanDate.toLocaleDateString('tr-TR');
            await sendWarningEmail(user.username, user.email, Son30GunUyariSayisi, formattedDate);
        }

        if (banTriggered) {
            await sendBanEmail(user.username, user.email, 'Sistem tarafından otomatik banlandı: Çok sayıda uyarı alma.' );
            return res.status(201).json({ message: 'Kullanıcıya başarıyla uyarı verildi ve uyarı limitini aştığı için otomatik olarak banlandı!' });
        } else {
            return res.status(201).json({ message: 'Kullanıcıya başarıyla uyarı verildi.' });
        }

    } catch (error) {
        if (transaction.active) {
            await transaction.rollback();
        }
        console.error('Uyarı verilirken hata:', error);
        return res.status(500).json({ message: 'İşlem sırasında bir sunucu hatası oluştu.' });
    }
});

// KULLANICININ OKUNMAMIŞ UYARILARINI GETİR (Basitleştirilmiş Hali)
app.get('/api/kullanici/yeni-uyarilar', async (req, res) => {
    try {
        // DÜZELTME: Kullanıcı ID'si, middleware yerine URL'den sorgu parametresi (query parameter) olarak alınır.
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ message: 'Kullanıcı ID bilgisi eksik.' });
        }

        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();
        request.input('userId', sql.Int, userId);
        
        // Sorgunun geri kalanı aynı
        const result = await request.query(`
            SELECT id, sebep, tarih FROM Uyari WHERE user_id = @userId AND okundu_mu = 0 ORDER BY tarih DESC
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error("Yeni uyarılar çekilirken hata:", error);
        res.status(500).json({ message: 'Uyarılar alınamadı.' });
    }
});

// --- KULLANICI PROFİLİNİ GÜNCELLEME ENDPOINT'İ ---
app.put('/api/kullanicilar/:id/profil', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, surname, email, age, gender } = req.body;

        // Gerekli alanların kontrolü
        if (!name || !surname || !email) {
            return res.status(400).json({ message: 'Ad, soyad ve e-posta alanları zorunludur.' });
        }
        if (!pool || !pool.connected) await connectDB();

        const request = pool.request();
        request.input('id', sql.Int, id);
        request.input('name', sql.NVarChar(50), name);
        request.input('surname', sql.NVarChar(50), surname);
        request.input('email', sql.NVarChar(100), email);
        request.input('age', sql.Date, age || null); // Tarih boş gelirse NULL olarak ayarla
        request.input('gender', sql.NVarChar(10), gender);

        const query = `
            UPDATE Kullanicilar 
            SET 
                name = @name, 
                surname = @surname, 
                email = @email, 
                age = @age, 
                gender = @gender
            WHERE id = @id
        `;
        
        const result = await request.query(query);

        // Eğer hiçbir satır etkilenmediyse, kullanıcı bulunamamıştır.
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Güncellenecek kullanıcı bulunamadı.' });
        }
        
        // Başarılı güncelleme sonrası güncel kullanıcı verisini geri gönderelim
        const guncelKullaniciResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, name, surname, email, age, gender, username FROM Kullanicilar WHERE id = @id');
            
        return res.status(200).json({ 
            message: 'Profil başarıyla güncellendi.',
            user: guncelKullaniciResult.recordset[0] 
        });

    } catch (hata) {
        console.error('❌ Profil Güncelleme Hatası:', hata);
        // E-posta zaten kullanımda gibi özel SQL hatalarını yakalamak için
        if (hata.number === 2627 || hata.number === 2601) {
            return res.status(409).json({ message: 'Bu e-posta adresi zaten başka bir kullanıcı tarafından kullanılıyor.' });
        }
        return res.status(500).json({ message: 'Profil güncellenirken bir sunucu hatası oluştu.' });
    }
});

// --- KULLANICI ARAMA ENDPOINT'İ ---
// --- KULLANICI ARAMA ENDPOINT'İ (kullanıcıara) ---
// Bu endpoint, React tarafındaki /api/kullanicilar/ara?q=... isteğine yanıt verir.
app.get('/api/kullaniciara', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || !q.trim()) {
            return res.json([]);
        }

        if (!pool || !pool.connected) await connectDB();

        const request = pool.request();
        request.input('searchTerm', sql.NVarChar, `%${q}%`);

        const query = `
            SELECT id, name, surname, username
            FROM Kullanicilar
            WHERE (name + ' ' + surname + ' ' + username) LIKE @searchTerm COLLATE Turkish_CI_AS
        `;

        const result = await request.query(query);
        return res.json(result.recordset);

    } catch (err) {
        console.error('❌ Kullanıcı Arama Hatası:', err);
        return res.status(500).json({ message: 'Arama sırasında hata oluştu.' });
    }
});

// --- GÜNLÜK PUANLAMA SİSTEMİ İÇİN API ENDPOINT'LERİ ---

// 1. TÜM EMOJİLERİ GETİREN ENDPOINT
// Frontend'deki emoji seçim alanını doldurmak için kullanılır.
app.get('/api/emojiler', async (req, res) => {
    try {
        if (!pool || !pool.connected) await connectDB();
        const result = await pool.request().query('SELECT * FROM Emojiler ORDER BY id');
        res.status(200).json(result.recordset);
    } catch (hata) {
        console.error('❌ Emojiler API hatası:', hata);
        res.status(500).json({ message: 'Emojiler alınırken bir hata oluştu.' });
    }
});

// 2. KULLANICIYA AİT TÜM GÜNLÜK GİRİŞLERİNİ GETİREN ENDPOINT
// Sayfa yüklendiğinde kullanıcının geçmiş verilerini grafiğe yansıtmak için kullanılır.
app.get('/api/gunluk-girisler/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!pool || !pool.connected) await connectDB();

        const request = pool.request();
        request.input('userId', sql.Int, userId);
        
        // Veritabanı tablonuzun adının 'GunlukGirisler' olduğunu varsayıyorum.
        const query = 'SELECT * FROM MoodGirisleri WHERE user_id = @userId ORDER BY date DESC';
        
        const result = await request.query(query);
        res.status(200).json(result.recordset);
    } catch (hata) {
        console.error('❌ Günlük girişleri API hatası:', hata);
        res.status(500).json({ message: 'Günlük girişleri alınırken bir hata oluştu.' });
    }
});

// 3. YENİ BİR GÜNLÜK GİRİŞİ EKLEYEN ENDPOINT
// Formdan 'Kaydet' butonuna basıldığında yeni girişi veritabanına ekler.
app.post('/api/gunluk-girisler', async (req, res) => {
    try {
        const { user_id, emoji_id, puan, content } = req.body;
        if (!user_id || !emoji_id || puan === undefined) {
            return res.status(400).json({ message: 'Eksik parametreler: user_id, emoji_id ve puan zorunludur.' });
        }

        if (!pool || !pool.connected) await connectDB();
        
        // Sunucu tarafında aynı gün için giriş var mı kontrolü (daha güvenli)
        const checkRequest = pool.request();
        checkRequest.input('user_id', sql.Int, user_id);
        const checkQuery = `
            SELECT 1 FROM MoodGirisleri 
            WHERE user_id = @user_id AND CAST(date AS DATE) = CAST(GETDATE() AS DATE)
        `;
        const existing = await checkRequest.query(checkQuery);

        if (existing.recordset.length > 0) {
            return res.status(409).json({ message: 'Bugün için zaten bir giriş yaptınız.' }); // 409 Conflict
        }

        // Yeni girişi ekle
        const insertRequest = pool.request();
        insertRequest.input('user_id', sql.Int, user_id);
        insertRequest.input('emoji_id', sql.Int, emoji_id);
        insertRequest.input('puan', sql.Int, puan);
        insertRequest.input('content', sql.NVarChar, content);

        const insertQuery = `
            INSERT INTO MoodGirisleri (user_id, emoji_id, content, puan, date)
            OUTPUT INSERTED.*
            VALUES (@user_id, @emoji_id, @content, @puan, GETDATE())
        `;
        const result = await insertRequest.query(insertQuery);
        
        // Eklenen yeni veriyi (ID ve tarih ile birlikte) frontend'e geri gönder
        res.status(201).json(result.recordset[0]);

    } catch (hata) {
        console.error('❌ Günlük girişi ekleme API hatası:', hata);
        res.status(500).json({ message: 'Giriş kaydedilirken bir hata oluştu.' });
    }
});

app.get('/api/iletisim-turleri', async (req, res) => {
    try {
        if (!pool || !pool.connected) await connectDB();
        
        const result = await pool.request().query('SELECT id, tur_adi FROM IletisimTurleri ORDER BY id');
        
        return res.json(result.recordset);

    } catch (error) {
        console.error('İletişim türleri çekilirken hata:', error);
        return res.status(500).json({ message: 'İletişim türleri alınamadı.' });
    }
});

app.post('/api/iletisim-mesaj-gonder', async (req, res) => {
    try {
        const { iletisim_tur_id, user_id, title, content } = req.body;

        // Gerekli alanların kontrolü
        if (!iletisim_tur_id || !title || !content) {
            return res.status(400).json({ message: 'Lütfen tüm zorunlu alanları doldurun.' });
        }
        if (title.trim() === '' || content.trim() === '') {
            return res.status(400).json({ message: 'Başlık ve mesaj içeriği boş olamaz.' });
        }
        
        if (!pool || !pool.connected) await connectDB();

        const request = pool.request();
        request.input('iletisim_tur_id', sql.Int, iletisim_tur_id);
        // user_id varsa ekle, yoksa NULL olarak geç.
        request.input('user_id', sql.Int, user_id || null);
        request.input('title', sql.NVarChar, title.trim());
        request.input('content', sql.NVarChar, content.trim());
        
        await request.query(`
            INSERT INTO IletisimMesajlari (iletisim_tur_id, user_id, title, content)
            VALUES (@iletisim_tur_id, @user_id, @title, @content)
        `);

        return res.status(201).json({ message: 'Mesajınız başarıyla gönderildi. En kısa sürede size geri dönüş yapacağız.' });

    } catch (err) {
        console.error('❌ İletişim Mesajı Gönderme API Hatası:', err);
        return res.status(500).json({ message: 'Mesajınız gönderilirken bir hata oluştu.', error: err.message });
    }
});

app.get('/api/admin/mesajlar', async (req, res) => {
    try {
        const { page = 1, limit = 10, turId } = req.query; // Sayfa, limit ve tür filtresi
        const offset = (page - 1) * limit;

        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();
        
        // Temel sorgu
        let query = `
            SELECT 
                im.id, im.title, im.content, im.gonderim_tarihi, im.durum,
                it.tur_adi,
                k.id as user_id, k.name as user_name, k.surname as user_surname, k.email as user_email
            FROM IletisimMesajlari im
            JOIN IletisimTurleri it ON im.iletisim_tur_id = it.id
            LEFT JOIN Kullanicilar k ON im.user_id = k.id
        `;
        
        let whereClauses = [];
        if (turId) {
            whereClauses.push(`im.iletisim_tur_id = @turId`);
            request.input('turId', sql.Int, turId);
        }
        if (whereClauses.length > 0) {
            query += ` WHERE ` + whereClauses.join(' AND ');
        }
        
        // Toplam kayıt sayısını almak için ayrı bir sorgu
        const totalResult = await request.query(`SELECT COUNT(*) as total FROM (${query}) as subquery`);
        const totalMessages = totalResult.recordset[0].total;

        // Sayfalamayı ve sıralamayı ana sorguya ekle
        query += `
            ORDER BY im.gonderim_tarihi DESC
            OFFSET ${offset} ROWS
            FETCH NEXT ${limit} ROWS ONLY;
        `;
        
        const messagesResult = await request.query(query);

        res.json({
            messages: messagesResult.recordset,
            totalPages: Math.ceil(totalMessages / limit)
        });

    } catch (error) {
        console.error('Mesajlar çekilirken hata:', error);
        res.status(500).json({ message: 'Mesajlar alınırken bir hata oluştu.' });
    }
});


// 2. BİR MESAJI "OKUNDU" OLARAK İŞARETLEYEN VE CEVAPLARI GETİREN API
app.get('/api/admin/mesajlar/:id', async (req, res) => {
    const { id } = req.params;
    if (!pool || !pool.connected) await connectDB();
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('mesajId', sql.Int, id);

        // Mesajı 'Okundu' olarak işaretle
        await request.query(`
            UPDATE IletisimMesajlari SET durum = 'Okundu' WHERE id = @mesajId AND durum = 'Yeni'
        `);
        
        // Mesaja ait eski cevapları getir
        const cevaplarResult = await request.query(`
            SELECT c.*, k.name as user_name, k.surname as user_surname 
            FROM IletisimCevap c
            JOIN Kullanicilar k ON c.user_id = k.id
            WHERE c.iletisim_mesaj_id = @mesajId
            ORDER BY c.cevap_tarihi ASC
        `);
        
        await transaction.commit();
        res.json(cevaplarResult.recordset);

    } catch (error) {
        if(transaction.active) await transaction.rollback();
        console.error('Mesaj detayı alınırken hata:', error);
        res.status(500).json({ message: 'Mesaj detayı alınırken bir hata oluştu.' });
    }
});


// 3. MESAJI CEVAPLAMA API'Sİ
app.post('/api/admin/mesaj-cevapla', async (req, res) => {
    const { iletisim_mesaj_id, user_id, content } = req.body;
    if (!iletisim_mesaj_id || !user_id || !content) {
        return res.status(400).json({ message: 'Tüm alanlar zorunludur.' });
    }

    if (!pool || !pool.connected) await connectDB();
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        // Cevabı kaydet
        request.input('mesajId', sql.Int, iletisim_mesaj_id);
        request.input('userId', sql.Int, user_id);
        request.input('content', sql.NVarChar, content);
        await request.query(`
            INSERT INTO IletisimCevap (iletisim_mesaj_id, user_id, content)
            VALUES (@mesajId, @userId, @content)
        `);

        // Ana mesajın durumunu 'Cevaplandı' yap
        await request.query(`
            UPDATE IletisimMesajlari SET durum = 'Cevaplandı' WHERE id = @mesajId
        `);

        await transaction.commit();
        res.status(201).json({ message: 'Cevap başarıyla gönderildi.' });

    } catch (error) {
        if(transaction.active) await transaction.rollback();
        console.error('Mesaj cevaplanırken hata:', error);
        res.status(500).json({ message: 'Mesaj cevaplanırken bir hata oluştu.' });
    }
});

app.get('/api/kullanici/mesajlarim/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ message: 'Kullanıcı ID bilgisi eksik.' });
        }
        
        if (!pool || !pool.connected) await connectDB();
        const request = pool.request();
        request.input('userId', sql.Int, userId);

        // Kullanıcının gönderdiği tüm mesajları çekiyoruz.
        const mesajlarResult = await request.query(`
            SELECT 
                im.id, im.title, im.content, im.gonderim_tarihi, im.durum,
                it.tur_adi
            FROM IletisimMesajlari im
            JOIN IletisimTurleri it ON im.iletisim_tur_id = it.id
            WHERE im.user_id = @userId
            ORDER BY im.gonderim_tarihi DESC
        `);

        const mesajlar = mesajlarResult.recordset;

        // Her bir mesaja ait cevapları bulup ekleyelim
        for (const mesaj of mesajlar) {
            const cevapRequest = pool.request();
            cevapRequest.input('mesajId', sql.Int, mesaj.id);
            const cevaplarResult = await cevapRequest.query(`
                SELECT c.*, k.name as user_name
                FROM IletisimCevap c
                JOIN Kullanicilar k ON c.user_id = k.id
                WHERE c.iletisim_mesaj_id = @mesajId
                ORDER BY c.cevap_tarihi ASC
            `);
            mesaj.cevaplar = cevaplarResult.recordset; // Cevapları mesaja ekle
        }

        res.json(mesajlar);

    } catch (error) {
        console.error('Kullanıcı mesajları çekilirken hata:', error);
        res.status(500).json({ message: 'Mesajlar alınırken bir hata oluştu.' });
    }
});

app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Bir hata oluştu' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Server'ı başlat
app.listen(PORT, () => {
    console.log(`🚀 Server ${PORT} portunda çalışıyor`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});