
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

function SifreDegistir() {
  // AuthContext'ten mevcut kullanıcıyı ve logout fonksiyonunu alıyoruz.
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [sifreler, setSifreler] = useState({
    eskiSifre: '',
    yeniSifre: '',
    yeniSifreOnay: ''
  });
  const [hata, setHata] = useState('');
  const [loading, setLoading] = useState(false); // Butonu pasif hale getirmek için

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSifreler(prev => ({ ...prev, [name]: value }));
  };

  // Fonksiyonu, içinde 'await' kullanacağımız için 'async' olarak güncelliyoruz.
  const handleSubmit = async (e) => { // handleSubmit kullandık çünkü bir buton işlevi ile çaılıyor useEffect ise sayfa yüklendiğinde anında olsun diye 
    e.preventDefault();
    setHata(''); // Her denemede eski hatayı temizle
    setLoading(true); // İşlem başlarken butonu kitle

    // 1. Frontend kontrolü: Yeni şifreler eşleşiyor mu?
    if (sifreler.yeniSifre !== sifreler.yeniSifreOnay) {
      setHata('Yeni şifreler uyuşmuyor.');
      setLoading(false); // Hata varsa butonu tekrar aktif et
      return;
    }

    // GÜVENSİZ KONTROL SİLİNDİ! Eski şifrenin doğruluğunu burada KONTROL ETMİYORUZ.
    // Bu işi artık backend yapacak.

    try {
      // 2. Backend'e istek atıyoruz.
      const response = await fetch(`http://localhost:5000/api/kullanicilar/${currentUser.id}/sifre-degistir`, { // hangi kişinin gönderdiğinin bilinmesi için gereklidir
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ //göndereceğimiz alan 
          eskiSifre: sifreler.eskiSifre,
          yeniSifre: sifreler.yeniSifre
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // İşlem başarılıysa...
        alert('Şifreniz başarıyla güncellendi! Güvenlik nedeniyle yeniden giriş yapmanız gerekmektedir.');
        logout(); // Kullanıcıyı sistemden çıkar
        navigate('/login'); // Login sayfasına yönlendir
      } else {
        // Backend'den bir hata mesajı geldiyse (örn: "Mevcut şifreniz yanlış.")
        setHata(data.message);
      }

    } catch (error) {
      console.error('Şifre değiştirme hatası:', error);
      setHata('Sunucuya bağlanırken bir sorun oluştu.');
    } finally {
      setLoading(false); // İşlem bitince (başarılı veya hatalı) butonu tekrar aktif et
    }
  };

  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <h2 className="mb-4">Şifreyi Güncelle</h2>
          <div className="card shadow-sm">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                {hata && <div className="alert alert-danger">{hata}</div>}
                <div className="mb-3">
                  <label htmlFor="eskiSifre" className="form-label">Mevcut Şifre</label>
                  <input type="password" id="eskiSifre" name="eskiSifre" className="form-control" value={sifreler.eskiSifre} onChange={handleChange} required />
                </div>
                <div className="mb-3">
                  <label htmlFor="yeniSifre" className="form-label">Yeni Şifre</label>
                  <input type="password" id="yeniSifre" name="yeniSifre" className="form-control" value={sifreler.yeniSifre} onChange={handleChange} required />
                </div>
                <div className="mb-3">
                  <label htmlFor="yeniSifreOnay" className="form-label">Yeni Şifre (Tekrar)</label>
                  <input type="password" id="yeniSifreOnay" name="yeniSifreOnay" className="form-control" value={sifreler.yeniSifreOnay} onChange={handleChange} required />
                </div>
                <div className="mt-4">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Güncelleniyor...' : 'Şifreyi Değiştir'}
                  </button>
                  <Link to="/profilim" className="btn btn-secondary ms-2">İptal</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SifreDegistir;
