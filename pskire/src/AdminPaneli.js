
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Swal from 'sweetalert2';
import './css/BanliPanel.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Şikayet edilen içeriğin türüne göre doğru URL'yi oluşturan yardımcı fonksiyon
const getIcerikPath = (sikayet) => {
  const { sikayet_anaid, icerik_id, ana_konu_id } = sikayet;
  switch (sikayet_anaid) {
    case 1: // Paylaşım
      return `/PaylasimDetay/${icerik_id}`;
    case 2: // Soru
      return `/sorular/${icerik_id}`;
    case 3: // Soru Yorumu
      if (ana_konu_id && ana_konu_id.startsWith('q')) {
        const soruId = ana_konu_id.substring(1);
        return `/sorular/${soruId}`;
      }
      return '#';
    case 4: // Tartışma
      return `/tartismalar/${icerik_id}`;
    case 5: // Tartışma Yorumu
      if (ana_konu_id && ana_konu_id.startsWith('t')) {
        const tartismaId = ana_konu_id.substring(1);
        return `/tartismalar/${tartismaId}`;
      }
      return '#';
    default:
      return '/';
  }
};

// İçerik render fonksiyonu
const renderIcerik = (data, tabName, page, handlePageChange) => {
  const itemsPerPage = 10;
  const startIndex = (page[tabName] - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = data.slice(startIndex, endIndex);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  if (data.length === 0) return <p className="text-muted">Bu kategoride içerik bulunamadı.</p>;

  return (
    <>
      <ul className="list-group list-group-flush">
        {currentItems.map((item, index) => (
          <li
            key={`${item.id}-${index}`}
            className="list-group-item d-flex justify-content-between align-items-center"
          >
            <div>
              <strong>{item.title || item.content.substring(0, 50) + '...'}</strong>
              <p className="mb-0 text-muted small">
                {item.content ? item.content.substring(0, 100) + '...' : ''}
              </p>
            </div>
            <small className="text-muted">
              {new Date(item.date).toLocaleDateString('tr-TR')}
            </small>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <nav className="mt-3">
          <ul className="pagination justify-content-center">
            {[...Array(totalPages)].map((_, i) => (
              <li
                key={i}
                className={`page-item ${page[tabName] === i + 1 ? 'active' : ''}`}
              >
                <button
                  className="page-link"
                  onClick={() => handlePageChange(tabName, i + 1)}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
};

function AdminPaneli() {
  const { currentUser } = useAuth();
  const [aktifSekme, setAktifSekme] = useState('sikayetler');
  const [sikayetler, setSikayetler] = useState([]);
  const [kaldirilanlar, setKaldirilanlar] = useState([]);
  const [banItirazlari, setBanItirazlari] = useState([]);
  const [seciliItiraz, setSeciliItiraz] = useState(null);
  const [itirazCevaplari, setItirazCevaplari] = useState([]);
  const [itirazCevap, setItirazCevap] = useState('');
  const [cevapGonderiliyor, setCevapGonderiliyor] = useState(false);
  const [userContent, setUserContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mesajlar, setMesajlar] = useState([]);
  const [toplamSayfa, setToplamSayfa] = useState(1);
  const [aktifSayfa, setAktifSayfa] = useState(1);
  const [filtreTurId, setFiltreTurId] = useState('');
  const [iletisimTurleri, setIletisimTurleri] = useState([]);
  const [seciliMesaj, setSeciliMesaj] = useState(null);
  const [cevaplar, setCevaplar] = useState([]);
  const [cevap, setCevap] = useState('');
  const [page, setPage] = useState({
    sorular: 1,
    yorumlar: 1,
    paylasimlar: 1,
    tartismalar: 1,
    tartismaYorumlari: 1,
  });
  const [aktifEklemeTuru, setAktifEklemeTuru] = useState(null);
  const [hastalikForm, setHastalikForm] = useState({ illness_name: '', slug: '' });
  const [ilacForm, setIlacForm] = useState({ medicine_name: '' });
  const [yanEtkiForm, setYanEtkiForm] = useState({ sideeffects_name: '' });

  const handlePageChange = (tabName, newPage) => {
    setPage((prev) => ({ ...prev, [tabName]: newPage }));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/admin/panel-data');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Panel verileri çekilemedi.');
      setSikayetler(data.sikayetler);
      setKaldirilanlar(data.kaldirilanlar);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMesajlar = useCallback(
    async (sayfa = 1, turId = '') => {
      setLoading(true);
      setError(null);
      try {
        if (iletisimTurleri.length === 0) {
          const turResponse = await fetch('http://localhost:5000/api/iletisim-turleri');
          const turData = await turResponse.json();
          if (turResponse.ok) setIletisimTurleri(turData);
        }
        const response = await fetch(
          `http://localhost:5000/api/admin/mesajlar?page=${sayfa}&limit=10&turId=${turId}`
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        setMesajlar(data.messages);
        setToplamSayfa(data.totalPages);
        setAktifSayfa(sayfa);
        setFiltreTurId(turId);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [iletisimTurleri.length]
  );

  const fetchBanItirazlari = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/admin/ban-itirazlari');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Ban itirazları çekilemedi.');

      // Group appeals by ID to avoid duplicates
      const groupedItirazlar = Object.values(
        data.reduce((acc, itiraz) => {
          if (!acc[itiraz.id]) {
            acc[itiraz.id] = { ...itiraz, responses: [] };
          }
          if (itiraz.response) {
            acc[itiraz.id].responses.push(itiraz.response);
          }
          return acc;
        }, {})
      );

      setBanItirazlari(groupedItirazlar);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchItirazDetay = async (itiraz) => {
    setSeciliItiraz(itiraz);
    setItirazCevaplari([]); // Clear existing responses to avoid stale data
    setUserContent(null);
    try {
      // Fetch user content
      const userContentResponse = await fetch(
        `http://localhost:5000/api/banli-panel-verisi/${itiraz.user_id}`
      );
      const userContentData = await userContentResponse.json();
      if (!userContentResponse.ok) {
        throw new Error(userContentData.message || 'Kullanıcı içeriği alınamadı.');
      }
      setUserContent(userContentData);

      // Fetch appeal responses explicitly
      const response = await fetch(
        `http://localhost:5000/api/admin/ban-itirazlari/${itiraz.id}`
      );
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || 'İtiraz cevapları alınamadı.');
      }
      setItirazCevaplari(responseData.responses || responseData || []);

      if (itiraz.cevaplanmis === 0) {
        setBanItirazlari((prev) =>
          prev.map((m) =>
            m.id === itiraz.id ? { ...m, cevaplanmis: 1 } : m
          )
        );
      }
    } catch (err) {
      Swal.fire('Hata!', err.message, 'error');
    }
  };

  // Update handleItirazCevapla to ensure responses are refreshed
  const handleItirazCevapla = async (e, status) => {
    e.preventDefault();
    if (!itirazCevap.trim()) {
      Swal.fire('Hata!', 'Cevap içeriği boş olamaz.', 'error');
      return;
    }
    setCevapGonderiliyor(true);
    try {
      const response = await fetch('http://localhost:5000/api/admin/ban-itiraz-cevapla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ban_id: seciliItiraz.id,
          user_id: currentUser.id,
          content: itirazCevap,
          status,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Cevap gönderilemedi.');

      // If status is 1 (accepted), remove the ban
      if (status === 1) {
        const banRemoveResponse = await fetch(
          `http://localhost:5000/api/admin/kullanici-ban-kaldir/${seciliItiraz.user_id}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        const banRemoveData = await banRemoveResponse.json();
        if (!banRemoveResponse.ok) {
          throw new Error(banRemoveData.message || 'Ban kaldırma işlemi başarısız.');
        }
      }

      // Show success message
      Swal.fire('Başarılı!', data.message, 'success');

      // Clear the response input
      setItirazCevap('');

      // Refetch appeal details to update responses
      await fetchItirazDetay(seciliItiraz);

      // Update the appeal's status in the list
      setBanItirazlari((prev) =>
        prev.map((m) =>
          m.id === seciliItiraz.id ? { ...m, cevaplanmis: 1 } : m
        )
      );
    } catch (err) {
      Swal.fire('Hata!', err.message, 'error');
    } finally {
      setCevapGonderiliyor(false);
    }
  };

  const getProfilPath = (targetUserId) => {
    if (currentUser && currentUser.id === targetUserId) {
      return '/profilim';
    }
    return `/profil/${targetUserId}`;
  };

  const handleGonderiyiKaldir = async (sikayet) => {
    const result = await Swal.fire({
      title: 'Emin misiniz?',
      text: 'Bu içeriği kalıcı olarak kaldırmak ve şikayeti kapatmak üzeresiniz.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ffc107',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Evet, içeriği kaldır!',
      cancelButtonText: 'İptal',
    });
    if (result.isConfirmed) {
      try {
        const response = await fetch('http://localhost:5000/api/admin/icerik-kaldir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sikayet: sikayet, kaldiran_id: currentUser.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        Swal.fire('Başarılı!', data.message, 'success');
        fetchData();
      } catch (err) {
        Swal.fire('Hata!', err.message, 'error');
      }
    }
  };

  const handleSikayetiKaldir = async (sikayetId) => {
    const result = await Swal.fire({
      title: 'Emin misiniz?',
      text: 'Bu şikayeti geçersiz sayacaksınız. İçerik silinmeyecektir.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Evet, şikayeti iptal et!',
      cancelButtonText: 'Vazgeç',
    });
    if (result.isConfirmed) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/sikayet/${sikayetId}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        Swal.fire('Başarılı!', data.message, 'success');
        fetchData();
      } catch (err) {
        Swal.fire('Hata!', err.message, 'error');
      }
    }
  };

  const handleIcerigiGeriAl = async (kaldirmaId) => {
    if (window.confirm('Bu içeriği geri yüklemek istediğinize emin misiniz?')) {
      try {
        const response = await fetch(
          `http://localhost:5000/api/admin/icerik-geri-al/${kaldirmaId}`,
          {
            method: 'DELETE',
          }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        Swal.fire('Başarılı!', data.message, 'success');
        fetchData();
      } catch (err) {
        Swal.fire('Hata!', err.message, 'error');
      }
    }
  };

  const handleKullaniciyiUyar = async (kullaniciId) => {
    const { value: sebep } = await Swal.fire({
      title: 'Kullanıcıyı Uyar',
      input: 'textarea',
      inputLabel: 'Uyarı Sebebi',
      inputPlaceholder: 'Lütfen uyarı sebebini buraya girin...',
      showCancelButton: true,
      confirmButtonText: 'Evet, Uyar!',
      cancelButtonText: 'İptal',
      confirmButtonColor: '#0dcaf0',
      inputValidator: (value) => {
        if (!value || value.trim() === '') {
          return 'Uyarı sebebi boş bırakılamaz!';
        }
      },
    });
    if (sebep) {
      try {
        const response = await fetch('http://localhost:5000/api/admin/kullanici-uyar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: kullaniciId,
            uyari_yapan_id: currentUser.id,
            sebep: sebep,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        Swal.fire('Başarılı!', data.message, 'success');
      } catch (err) {
        Swal.fire('Hata!', err.message, 'error');
      }
    }
  };

  const handleKullaniciyiBanla = async (kullaniciId) => {
    const { value: sebep } = await Swal.fire({
      title: 'Kullanıcıyı Banla',
      input: 'textarea',
      inputLabel: 'Ban Sebebi',
      inputPlaceholder: 'Lütfen banlama sebebini buraya girin...',
      showCancelButton: true,
      confirmButtonText: 'Evet, Banla!',
      cancelButtonText: 'İptal',
      confirmButtonColor: '#d33',
      inputValidator: (value) => {
        if (!value || value.trim() === '') {
          return 'Ban sebebi boş bırakılamaz!';
        }
      },
    });
    if (sebep) {
      try {
        const response = await fetch('http://localhost:5000/api/admin/kullanici-banla', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: kullaniciId,
            banlayan_id: currentUser.id,
            sebep: sebep,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        Swal.fire('Başarılı!', data.message, 'success');
        fetchData();
      } catch (err) {
        Swal.fire('Hata!', err.message, 'error');
      }
    }
  };

  const handleMesajSec = async (mesaj) => {
    setSeciliMesaj(mesaj);
    setCevaplar([]);
    try {
      const response = await fetch(`http://localhost:5000/api/admin/mesajlar/${mesaj.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setCevaplar(data);
      if (mesaj.durum === 'Yeni') {
        setMesajlar((prev) =>
          prev.map((m) => (m.id === mesaj.id ? { ...m, durum: 'Okundu' } : m))
        );
      }
    } catch (err) {
      Swal.fire('Hata!', err.message, 'error');
    }
  };

  const handleCevapGonder = async (e) => {
    e.preventDefault();
    if (!cevap.trim()) {
      Swal.fire('Hata!', 'Cevap içeriği boş olamaz.', 'error');
      return;
    }
    setCevapGonderiliyor(true);
    try {
      const response = await fetch('http://localhost:5000/api/admin/mesaj-cevapla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iletisim_mesaj_id: seciliMesaj.id,
          user_id: currentUser.id,
          content: cevap,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      Swal.fire('Başarılı!', data.message, 'success');
      setCevap('');
      handleMesajSec(seciliMesaj);
      setMesajlar((prev) =>
        prev.map((m) =>
          m.id === seciliMesaj.id ? { ...m, durum: 'Cevaplandı' } : m
        )
      );
    } catch (err) {
      Swal.fire('Hata!', err.message, 'error');
    } finally {
      setCevapGonderiliyor(false);
    }
  };

  const handleEklemeTuruSec = (tur) => {
    setAktifEklemeTuru(tur);
    // Formları sıfırla
    setHastalikForm({ illness_name: '', slug: '' });
    setIlacForm({ medicine_name: '' });
    setYanEtkiForm({ sideeffects_name: '' });
  };

  const handleHastalikDegisiklik = (e) => {
    setHastalikForm({ ...hastalikForm, [e.target.name]: e.target.value });
  };

  const handleIlacDegisiklik = (e) => {
    setIlacForm({ ...ilacForm, [e.target.name]: e.target.value });
  };

  const handleYanEtkiDegisiklik = (e) => {
    setYanEtkiForm({ ...yanEtkiForm, [e.target.name]: e.target.value });
  };

  const handleHastalikEkle = async (e) => {
    e.preventDefault();
    if (!hastalikForm.illness_name.trim() || !hastalikForm.slug.trim()) {
      Swal.fire('Hata!', 'Hastalık adı ve slug zorunludur.', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/hastalikekle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hastalikForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Hastalık eklenemedi.');
      Swal.fire('Başarılı!', 'Hastalık başarıyla eklendi.', 'success');
      setHastalikForm({ illness_name: '', slug: '' });
    } catch (err) {
      Swal.fire('Hata!', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleIlacEkle = async (e) => {
    e.preventDefault();
    if (!ilacForm.medicine_name.trim()) {
      Swal.fire('Hata!', 'İlaç adı zorunludur.', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/ilacekle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ilacForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'İlaç eklenemedi.');
      Swal.fire('Başarılı!', 'İlaç başarıyla eklendi.', 'success');
      setIlacForm({ medicine_name: '' });
    } catch (err) {
      Swal.fire('Hata!', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleYanEtkiEkle = async (e) => {
    e.preventDefault();
    if (!yanEtkiForm.sideeffects_name.trim()) {
      Swal.fire('Hata!', 'Yan etki adı zorunludur.', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/yanetkiekle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(yanEtkiForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Yan etki eklenemedi.');
      Swal.fire('Başarılı!', 'Yan etki başarıyla eklendi.', 'success');
      setYanEtkiForm({ sideeffects_name: '' });
    } catch (err) {
      Swal.fire('Hata!', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.rol === 'admin' || currentUser?.rol === 'moderator') {
      if (aktifSekme === 'mesajlar') {
        fetchMesajlar(aktifSayfa, filtreTurId);
      } else if (aktifSekme === 'banItirazlari') {
        fetchBanItirazlari();
      } else if (aktifSekme === 'sikayetler' || aktifSekme === 'kaldirilanlar') {
        fetchData();
      }
    }
  }, [aktifSekme, currentUser, fetchData, fetchMesajlar, fetchBanItirazlari, aktifSayfa, filtreTurId]);

  if (currentUser?.rol !== 'admin' && currentUser?.rol !== 'moderator') {
    return (
      <div className="container my-5 alert alert-danger text-center">
        Bu sayfayı görüntüleme yetkiniz yok.
      </div>
    );
  }

  if (loading) return <div className="container my-5 text-center">Yükleniyor...</div>;

  if (error) return <div className="container my-5 alert alert-danger">{error}</div>;

  return (
    <div className="container my-5">
      <h1 className="h2 mb-4">Yönetim Paneli</h1>
      <ul className="nav nav-tabs nav-fill mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${aktifSekme === 'sikayetler' ? 'active' : ''}`}
            onClick={() => setAktifSekme('sikayetler')}
          >
            Şikayet Edilen İçerikler{' '}
            <span className="badge bg-danger ms-1">{sikayetler.length}</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${aktifSekme === 'kaldirilanlar' ? 'active' : ''}`}
            onClick={() => setAktifSekme('kaldirilanlar')}
          >
            Kaldırılan İçerikler{' '}
            <span className="badge bg-secondary ms-1">{kaldirilanlar.length}</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${aktifSekme === 'mesajlar' ? 'active' : ''}`}
            onClick={() => setAktifSekme('mesajlar')}
          >
            İletişim Mesajları
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${aktifSekme === 'banItirazlari' ? 'active' : ''}`}
            onClick={() => setAktifSekme('banItirazlari')}
          >
            Ban İtirazları{' '}
            <span className="badge bg-warning ms-1">{banItirazlari.length}</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${aktifSekme === 'yeniAlanEkle' ? 'active' : ''}`}
            onClick={() => setAktifSekme('yeniAlanEkle')}
          >
            Yeni Alan Ekle
          </button>
        </li>
      </ul>

      {aktifSekme === 'sikayetler' && (
        <div>
          {sikayetler.length === 0 ? (
            <p>Bekleyen şikayet bulunmuyor.</p>
          ) : (
            sikayetler.map((sikayet) => (
              <div key={sikayet.sikayet_id} className="card mb-3">
                <div className="card-header d-flex justify-content-between">
                  <div>
                    <span className={`badge me-2 bg-warning text-dark`}>{sikayet.tur}</span>
                    <strong>{sikayet.baslik}</strong>
                  </div>
                  <small>
                    Şikayet Tarihi: {new Date(sikayet.sikayet_tarihi).toLocaleDateString('tr-TR')}
                  </small>
                </div>
                <div className="card-body">
                  <p className="fst-italic">"{String(sikayet.icerik).substring(0, 150)}..."</p>
                  <Link to={getProfilPath(sikayet.icerik_sahibi_id)} className="text-decoration-none">
                    <p className="card-text text-muted">
                      <strong>İçerik Sahibi:</strong> {sikayet.icerik_sahibi_adi}
                    </p>
                  </Link>
                  <Link
                    to={getIcerikPath(sikayet)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-primary me-2"
                  >
                    İçeriğe Git
                  </Link>
                </div>
                <div className="card-footer text-end">
                  <button
                    className="btn btn-sm btn-info me-2"
                    onClick={() => handleKullaniciyiUyar(sikayet.icerik_sahibi_id)}
                  >
                    Kullanıcıyı Uyar
                  </button>
                  <button
                    className="btn btn-sm btn-warning me-2"
                    onClick={() => handleGonderiyiKaldir(sikayet)}
                  >
                    İçeriği Kaldır
                  </button>
                  <button
                    className="btn btn-sm btn-success me-2"
                    onClick={() => handleSikayetiKaldir(sikayet.sikayet_id)}
                  >
                    Şikayeti İptal Et
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleKullaniciyiBanla(sikayet.icerik_sahibi_id)}
                  >
                    Kullanıcıyı Banla
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {aktifSekme === 'kaldirilanlar' && (
        <div>
          {kaldirilanlar.length === 0 ? (
            <p>Kaldırılmış içerik bulunmuyor.</p>
          ) : (
            kaldirilanlar.map((item) => {
              const icerikSahibiPath =
                currentUser.id === item.icerik_sahibi_id
                  ? `/profilim`
                  : `/profil/${item.icerik_sahibi_id}`;
              const kaldiranKisiPath =
                currentUser.id === item.kaldiran_id
                  ? `/profilim`
                  : `/profil/${item.kaldiran_id}`;
              return (
                <div key={item.kaldirma_pk_id} className="card mb-3 border-secondary">
                  <div className="card-header d-flex justify-content-between bg-secondary bg-opacity-10">
                    <div>
                      <span className={`badge me-2 bg-secondary`}>{item.tur}</span>
                      <strong>{item.baslik}</strong>
                    </div>
                    <small>
                      Kaldırılma Tarihi: {new Date(item.kaldirma_tarihi).toLocaleDateString('tr-TR')}
                    </small>
                  </div>
                  <div className="card-body">
                    <p className="fst-italic text-muted">"{String(item.icerik).substring(0, 150)}..."</p>
                    <Link to={icerikSahibiPath} className="text-decoration-none text-muted">
                      <p className="card-text">
                        <strong>İçerik Sahibi:</strong> {item.icerik_sahibi_adi}{' '}
                        {item.icerik_sahibi_soyadi}
                      </p>
                    </Link>
                    <Link to={kaldiranKisiPath} className="text-decoration-none text-muted">
                      <p className="card-text">
                        <strong>Kaldıran Kişi:</strong> {item.kaldiran_adi} {item.kaldiran_soyadi}
                      </p>
                    </Link>
                  </div>
                  <div className="card-footer text-end bg-transparent">
                    <button
                      className="btn btn-sm btn-info"
                      onClick={() => handleIcerigiGeriAl(item.kaldirma_pk_id)}
                    >
                      İçeriği Geri Al
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {aktifSekme === 'mesajlar' && (
        <div>
          <div className="row">
            <div className="col-md-5">
              <div className="d-flex mb-3">
                <select
                  className="form-select"
                  value={filtreTurId}
                  onChange={(e) => setFiltreTurId(e.target.value)}
                >
                  <option value="">Tüm Türler</option>
                  {iletisimTurleri.map((tur) => (
                    <option key={tur.id} value={tur.id}>
                      {tur.tur_adi}
                    </option>
                  ))}
                </select>
              </div>
              {loading ? (
                <p>Mesajlar yükleniyor...</p>
              ) : mesajlar.length === 0 ? (
                <p>Görüntülenecek mesaj bulunmuyor.</p>
              ) : (
                <div className="list-group">
                  {mesajlar.map((mesaj) => (
                    <button
                      key={mesaj.id}
                      onClick={() => handleMesajSec(mesaj)}
                      className={`list-group-item list-group-item-action ${
                        seciliMesaj?.id === mesaj.id ? 'active' : ''
                      } ${mesaj.durum !== 'Yeni' ? 'text-muted' : ''}`}
                    >
                      <div className="d-flex w-100 justify-content-between">
                        <h5 className="mb-1">{mesaj.title}</h5>
                        <small>{new Date(mesaj.gonderim_tarihi).toLocaleDateString('tr-TR')}</small>
                      </div>
                      <p className="mb-1">
                        {mesaj.user_name
                          ? `${mesaj.user_name} ${mesaj.user_surname}`
                          : 'Misafir Kullanıcı'}{' '}
                        -{' '}
                        <span
                          className={`badge ${
                            mesaj.durum === 'Cevaplandı' ? 'bg-success' : 'bg-info'
                          }`}
                        >
                          {mesaj.tur_adi}
                        </span>
                      </p>
                    </button>
                  ))}
                </div>
              )}
              <nav className="mt-3">
                <ul className="pagination">
                  {[...Array(toplamSayfa).keys()].map((num) => (
                    <li
                      key={num + 1}
                      className={`page-item ${aktifSayfa === num + 1 ? 'active' : ''}`}
                    >
                      <button onClick={() => setAktifSayfa(num + 1)} className="page-link">
                        {num + 1}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className="col-md-7">
              {seciliMesaj ? (
                <div className="card">
                  <div className="card-header">
                    <h5>{seciliMesaj.title}</h5>
                    <p className="mb-0 small text-muted">
                      <strong>Gönderen:</strong>{' '}
                      {seciliMesaj.user_name || seciliMesaj.email || 'Misafir'}
                    </p>
                  </div>
                  <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{seciliMesaj.content}</p>
                    <hr />
                    <h6>Geçmiş Cevaplar</h6>
                    {cevaplar.length > 0 ? (
                      cevaplar.map((c) => (
                        <div key={c.id} className="alert alert-secondary">
                          <strong>{c.user_name}:</strong> {c.content}
                          <small className="d-block text-end">
                            {new Date(c.cevap_tarihi).toLocaleString('tr-TR')}
                          </small>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted small">Bu mesaja henüz cevap verilmemiş.</p>
                    )}
                  </div>
                  <div className="card-footer">
                    <form onSubmit={handleCevapGonder}>
                      <div className="mb-2">
                        <label className="form-label">Cevap Yaz</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          value={cevap}
                          onChange={(e) => setCevap(e.target.value)}
                          required
                        ></textarea>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={cevapGonderiliyor}
                      >
                        {cevapGonderiliyor ? 'Gönderiliyor...' : 'Cevabı Gönder'}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="text-center p-5 border rounded bg-light">
                  <i className="bi bi-chat-left-text fs-1 text-muted"></i>
                  <p className="mt-3">
                    Görüntülemek ve cevaplamak için listeden bir mesaj seçin.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {aktifSekme === 'banItirazlari' && (
        <div>
          <div className="row">
            <div className="col-md-5">
              {loading ? (
                <p>İtirazlar yükleniyor...</p>
              ) : banItirazlari.length === 0 ? (
                <p>Görüntülenecek ban itirazı bulunmuyor.</p>
              ) : (
                <div className="list-group">
                  {banItirazlari.map((itiraz) => (
                    <button
                      key={itiraz.id}
                      onClick={() => fetchItirazDetay(itiraz)}
                      className={`list-group-item list-group-item-action ${
                        seciliItiraz?.id === itiraz.id ? 'active' : ''
                      } ${itiraz.cevaplanmis === 1 ? 'text-muted' : ''}`}
                    >
                      <div className="d-flex w-100 justify-content-between">
                        <h5 className="mb-1">{`${itiraz.user_name} ${itiraz.user_surname}`}</h5>
                        <small>{new Date(itiraz.date).toLocaleDateString('tr-TR')}</small>
                      </div>
                      <p className="mb-1">{itiraz.content.substring(0, 50) + '...'}</p>
                      <span
                        className={`badge ${
                          itiraz.cevaplanmis === 1 ? 'bg-success' : 'bg-info'
                        }`}
                      >
                        {itiraz.cevaplanmis === 1 ? 'Cevaplandı' : 'Okunmadı'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-md-7">
              {seciliItiraz ? (
                <div className="card">
                  <div className="card-header">
                    <h5>
                      Ban İtirazı: {seciliItiraz.user_name} {seciliItiraz.user_surname}
                    </h5>
                    <p className="mb-0 small text-muted">
                      <strong>Gönderim Tarihi:</strong>{' '}
                      {new Date(seciliItiraz.date).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{seciliItiraz.content}</p>
                    <hr />
                    <h6>Geçmiş Cevaplar</h6>
                    {itirazCevaplari.length > 0 ? (
                      itirazCevaplari.map((c) => (
                        <div
                          key={c.id}
                          className={`alert ${c.status === 1 ? 'alert-success' : 'alert-danger'}`}
                        >
                          <strong>
                            {c.user_name} {c.user_surname}:
                          </strong>{' '}
                          {c.content}
                          <small className="d-block text-end">
                            {new Date(c.date).toLocaleString('tr-TR')}
                          </small>
                          <span className="badge bg-info">
                            {c.status === 1 ? 'Kabul Edildi' : 'Reddedildi'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted small">Bu itiraza henüz cevap verilmemiş.</p>
                    )}
                  </div>
                  <div className="card-footer">
                    <form>
                      <div className="mb-2">
                        <label className="form-label">Cevap Yaz</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          value={itirazCevap}
                          onChange={(e) => setItirazCevap(e.target.value)}
                          required
                        ></textarea>
                      </div>
                      <div className="d-flex justify-content-between">
                        <button
                          type="submit"
                          className="btn btn-success"
                          onClick={(e) => handleItirazCevapla(e, 1)}
                          disabled={cevapGonderiliyor}
                        >
                          {cevapGonderiliyor ? 'Gönderiliyor...' : 'Kabul Et'}
                        </button>
                        <button
                          type="submit"
                          className="btn btn-danger"
                          onClick={(e) => handleItirazCevapla(e, 0)}
                          disabled={cevapGonderiliyor}
                        >
                          {cevapGonderiliyor ? 'Gönderiliyor...' : 'Reddet'}
                        </button>
                      </div>
                    </form>
                  </div>
                  {userContent && (
                    <div className="icerik-kartlari mt-4">
                      <h3>İçerikleriniz</h3>
                      <div className="accordion" id="icerikAccordion">
                        <div className="accordion-item">
                          <h2 className="accordion-header">
                            <button
                              className="accordion-button"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target="#collapseUyarilar"
                            >
                              Aldığınız Uyarılar ({userContent.uyarilar?.length || 0})
                            </button>
                          </h2>
                          <div
                            id="collapseUyarilar"
                            className="accordion-collapse collapse show"
                            data-bs-parent="#icerikAccordion"
                          >
                            <div className="accordion-body">
                              {!userContent.uyarilar || userContent.uyarilar.length === 0 ? (
                                <p className="text-muted">
                                  Hesabınızda uyarı bulunmamaktadır.
                                </p>
                              ) : (
                                <ul className="list-group list-group-flush">
                                  {userContent.uyarilar.map((uyari) => (
                                    <li key={uyari.id} className="list-group-item">
                                      <strong>Sebep:</strong> {uyari.sebep} <br />
                                      <small className="text-muted">
                                        Tarih: {new Date(uyari.tarih).toLocaleDateString('tr-TR')}
                                      </small>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="accordion-item">
                          <h2 className="accordion-header">
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target="#collapsePaylasimlar"
                            >
                              Paylaşımlarınız ({userContent.paylasimlar?.length || 0})
                            </button>
                          </h2>
                          <div
                            id="collapsePaylasimlar"
                            className="accordion-collapse collapse"
                            data-bs-parent="#icerikAccordion"
                          >
                            <div className="accordion-body">
                              {renderIcerik(
                                userContent.paylasimlar || [],
                                'paylasimlar',
                                page,
                                handlePageChange
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="accordion-item">
                          <h2 className="accordion-header">
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target="#collapseSorular"
                            >
                              Sorduğunuz Sorular ({userContent.sorular?.length || 0})
                            </button>
                          </h2>
                          <div
                            id="collapseSorular"
                            className="accordion-collapse collapse"
                            data-bs-parent="#icerikAccordion"
                          >
                            <div className="accordion-body">
                              {renderIcerik(
                                userContent.sorular || [],
                                'sorular',
                                page,
                                handlePageChange
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="accordion-item">
                          <h2 className="accordion-header">
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target="#collapseYorumlar"
                            >
                              Yaptığınız Yorumlar ({userContent.yorumlar?.length || 0})
                            </button>
                          </h2>
                          <div
                            id="collapseYorumlar"
                            className="accordion-collapse collapse"
                            data-bs-parent="#icerikAccordion"
                          >
                            <div className="accordion-body">
                              {renderIcerik(
                                userContent.yorumlar || [],
                                'yorumlar',
                                page,
                                handlePageChange
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="accordion-item">
                          <h2 className="accordion-header">
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target="#collapseTartismalar"
                            >
                              Tartışmalarınız ({userContent.tartismalar?.length || 0})
                            </button>
                          </h2>
                          <div
                            id="collapseTartismalar"
                            className="accordion-collapse collapse"
                            data-bs-parent="#icerikAccordion"
                          >
                            <div className="accordion-body">
                              {renderIcerik(
                                userContent.tartismalar || [],
                                'tartismalar',
                                page,
                                handlePageChange
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="accordion-item">
                          <h2 className="accordion-header">
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target="#collapseTartismaYorumlari"
                            >
                              Tartışma Yorumlarınız ({userContent.tartismaYorumlari?.length || 0})
                            </button>
                          </h2>
                          <div
                            id="collapseTartismaYorumlari"
                            className="accordion-collapse collapse"
                            data-bs-parent="#icerikAccordion"
                          >
                            <div className="accordion-body">
                              {renderIcerik(
                                userContent.tartismaYorumlari || [],
                                'tartismaYorumlari',
                                page,
                                handlePageChange
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-5 border rounded bg-light">
                  <i className="bi bi-exclamation-triangle fs-1 text-muted"></i>
                  <p className="mt-3">
                    Görüntülemek ve cevaplamak için listeden bir ban itirazı seçin.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {aktifSekme === 'yeniAlanEkle' && (
        <div>
          <div className="row">
            <div className="col-md-5">
              <div className="list-group">
                <button
                  className={`list-group-item list-group-item-action ${aktifEklemeTuru === 'hastalik' ? 'active' : ''}`}
                  onClick={() => handleEklemeTuruSec('hastalik')}
                >
                  Hastalık Ekle
                </button>
                <button
                  className={`list-group-item list-group-item-action ${aktifEklemeTuru === 'ilac' ? 'active' : ''}`}
                  onClick={() => handleEklemeTuruSec('ilac')}
                >
                  İlaç Ekle
                </button>
                <button
                  className={`list-group-item list-group-item-action ${aktifEklemeTuru === 'yanetki' ? 'active' : ''}`}
                  onClick={() => handleEklemeTuruSec('yanetki')}
                >
                  Yan Etki Ekle
                </button>
              </div>
            </div>
            <div className="col-md-7">
              {aktifEklemeTuru ? (
                <div className="card">
                  <div className="card-header">
                    <h5>{aktifEklemeTuru === 'hastalik' ? 'Yeni Hastalık Ekle' : aktifEklemeTuru === 'ilac' ? 'Yeni İlaç Ekle' : 'Yeni Yan Etki Ekle'}</h5>
                  </div>
                  <div className="card-body">
                    {aktifEklemeTuru === 'hastalik' && (
                      <form onSubmit={handleHastalikEkle}>
                        <div className="mb-3">
                          <label className="form-label">Hastalık Adı</label>
                          <input
                            type="text"
                            className="form-control"
                            name="illness_name"
                            value={hastalikForm.illness_name}
                            onChange={handleHastalikDegisiklik}
                            required
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Slug</label>
                          <input
                            type="text"
                            className="form-control"
                            name="slug"
                            value={hastalikForm.slug}
                            onChange={handleHastalikDegisiklik}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                          {loading ? 'Ekleniyor...' : 'Ekle'}
                        </button>
                      </form>
                    )}
                    {aktifEklemeTuru === 'ilac' && (
                      <form onSubmit={handleIlacEkle}>
                        <div className="mb-3">
                          <label className="form-label">İlaç Adı</label>
                          <input
                            type="text"
                            className="form-control"
                            name="medicine_name"
                            value={ilacForm.medicine_name}
                            onChange={handleIlacDegisiklik}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                          {loading ? 'Ekleniyor...' : 'Ekle'}
                        </button>
                      </form>
                    )}
                    {aktifEklemeTuru === 'yanetki' && (
                      <form onSubmit={handleYanEtkiEkle}>
                        <div className="mb-3">
                          <label className="form-label">Yan Etki Adı</label>
                          <input
                            type="text"
                            className="form-control"
                            name="sideeffects_name"
                            value={yanEtkiForm.sideeffects_name}
                            onChange={handleYanEtkiDegisiklik}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                          {loading ? 'Ekleniyor...' : 'Ekle'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center p-5 border rounded bg-light">
                  <i className="bi bi-plus-circle fs-1 text-muted"></i>
                  <p className="mt-3">
                    Eklemek istediğiniz alanı listeden seçin.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPaneli;