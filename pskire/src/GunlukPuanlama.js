import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from './context/AuthContext'; 
import './css/Gunluk.css';
import { Link } from 'react-router-dom';
import { useTarihNavigasyon } from './hooks/useTarihNavigasyon';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// =======================================================
//  ALT BİLEŞENLER
// =======================================================

const Bildirim = ({ mesaj, tip, onKapat }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onKapat();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onKapat]);

  if (!mesaj) return null;

  return (
    <div className={`notification-toast ${tip === 'hata' ? 'hata' : 'basari'} show`}>
      {mesaj}
      <button onClick={onKapat} className="toast-close-btn">&times;</button>
    </div>
  );
};

const PuanGrafigi = ({ filtrelenmisGirisler, chartTitle, onBarClick }) => {
  const chartData = useMemo(() => ({
    originalData: filtrelenmisGirisler,
    labels: filtrelenmisGirisler.map(g => new Date(g.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Günlük Puan',
      data: filtrelenmisGirisler.map(g => g.puan),
      backgroundColor: 'rgba(108, 92, 231, 0.6)',
      borderColor: 'rgba(108, 92, 231, 1)',
      borderWidth: 1,
      borderRadius: 5,
      hoverBackgroundColor: 'rgba(108, 92, 231, 0.8)',
    }],
  }), [filtrelenmisGirisler]);
  
  const handleChartClick = (event, elements) => {
    if (elements.length > 0) {
      onBarClick(chartData.originalData[elements[0].index]);
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: chartTitle, font: { size: 16, family: 'Poppins' }, color: '#333' },
      tooltip: { backgroundColor: '#333', titleFont: { family: 'Poppins' }, bodyFont: { family: 'Poppins' } }
    },
    scales: { 
      y: { beginAtZero: true, max: 10 },
      x: { ticks: { font: { family: 'Poppins' } } }
    },
    onClick: handleChartClick,
  };

  return <Bar options={chartOptions} data={chartData} />;
};

const GunlukGirisFormu = ({ onGirisEkle, onBildirimGoster, emojiler, isBugunGirisYapildi }) => {
    const [secilenEmoji, setSecilenEmoji] = useState(null);
    const [puan, setPuan] = useState(5);
    const [yorum, setYorum] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isBugunGirisYapildi) {
            onBildirimGoster('Bugün için zaten bir giriş yaptınız.', 'hata');
            return;
        }
        if (!secilenEmoji) { 
            onBildirimGoster('Lütfen gününüzü özetleyen bir emoji seçin.', 'hata');
            return; 
        }
        onGirisEkle({ emoji_id: secilenEmoji, puan: Number(puan), content: yorum });
        setSecilenEmoji(null); setPuan(5); setYorum('');
    };

    return (
        <div className="mood-card entry-form-card h-100">
            <div className="card-header"><h5 className="mb-0">Bugün Nasılsın?</h5></div>
            <div className="card-body">
                <form onSubmit={handleSubmit} className="d-flex flex-column h-100">
                    <div className="mb-4">
                        <label className="form-label fw-bold">Günün emojisi:</label>
                        <div className="emoji-selector">
                            {emojiler.map(emoji => (
                                <i 
                                    key={emoji.id} 
                                    className={`${emoji.emoji_icon} emoji-item ${secilenEmoji === emoji.id ? 'selected' : ''}`}
                                    style={{ color: emoji.color }} 
                                    onClick={() => setSecilenEmoji(emoji.id)} 
                                    title={emoji.label}
                                ></i>
                            ))}
                        </div>
                    </div>
                    <div className="mb-4">
                        <label htmlFor="puanRange" className="form-label fw-bold">Gününe 1-10 arası puan ver: <span className="badge puan-badge">{puan}</span></label>
                        <input type="range" className="form-range" min="1" max="10" step="1" id="puanRange" value={puan} onChange={(e) => setPuan(e.target.value)} />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="yorum" className="form-label fw-bold">Günün hakkında bir şeyler yaz:</label>
                        <textarea className="form-control" id="yorum" rows="3" value={yorum} onChange={(e) => setYorum(e.target.value)} placeholder="Bugün neler oldu?"></textarea>
                    </div>
                    <button type="submit" className="btn btn-save w-100 mt-auto">Kaydet</button>
                </form>
            </div>
        </div>
    );
};

const GirisDetayi = ({ giris, onClose, emojiler }) => {
    if (!giris) return null;
    const emojiDetay = emojiler.find(e => e.id === giris.emoji_id);
    return (
        <div className="mood-card details-card">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Seçilen Günün Detayı</h5>
                <button type="button" className="btn-close" onClick={onClose} aria-label="Kapat"></button>
            </div>
            <div className="card-body">
                <div className="details-header">
                    {emojiDetay && <i className={`${emojiDetay.emoji_icon}`} style={{ color: emojiDetay.color }}></i>}
                    <div>
                        <div className="details-date">{new Date(giris.date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        <div className="text-muted">Verilen Puan: <span className="badge bg-info details-puan">{giris.puan} / 10</span></div>
                    </div>
                </div>
                <div className="details-comment">
                    <p className="mb-0 fst-italic">"{giris.content || 'Bu gün için bir yorum girilmemiş.'}"</p>
                </div>
            </div>
        </div>
    );
};

// =======================================================
//  ANA BİLEŞEN
// =======================================================
function GunlukPuanlama() {
    const { currentUser } = useAuth();
    const [girisler, setGirisler] = useState([]);
    const [emojiler, setEmojiler] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [seciliGiris, setSeciliGiris] = useState(null);
    const [mod, setMod] = useState('ay');
    const [gosterilenTarih, setGosterilenTarih] = useState(new Date());
    const [bildirim, setBildirim] = useState({ mesaj: '', tip: '' });

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const fetchInitialData = async () => {
            try {
                setLoading(true);
                const [girislerResponse, emojilerResponse] = await Promise.all([
                    fetch(`/api/gunluk-girisler/${currentUser.id}`),
                    fetch('/api/emojiler')
                ]);

                if (!girislerResponse.ok || !emojilerResponse.ok) {
                    throw new Error('Veriler sunucudan alınamadı.');
                }

                const girislerData = await girislerResponse.json();
                const emojilerData = await emojilerResponse.json();

                setGirisler(girislerData);
                setEmojiler(emojilerData);

            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [currentUser]);

    const { baslangicTarihi, bitisTarihi, etiket, isIleriButonuAktif } = useTarihNavigasyon(gosterilenTarih, mod);
 
    const { filtrelenmisGirisler, chartTitle, isBugunGirisYapildi } = useMemo(() => {
        const filtered = girisler.filter(g => {
            const girisTarihi = new Date(g.date);
            return girisTarihi >= baslangicTarihi && girisTarihi <= bitisTarihi;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let title = etiket;
        if (filtered.length > 0) {
            const toplamPuan = filtered.reduce((acc, g) => acc + g.puan, 0);
            const average = toplamPuan / filtered.length;
            title += ` (Ort: ${average.toFixed(1)})`;
        }
        
        const bugunStr = new Date().toDateString();
        const bugunGiris = girisler.some(g => new Date(g.date).toDateString() === bugunStr);

        return { filtrelenmisGirisler: filtered, chartTitle: title, isBugunGirisYapildi: bugunGiris };
    }, [girisler, baslangicTarihi, bitisTarihi, etiket]);

    const handleBildirimGoster = (mesaj, tip) => {
        setBildirim({ mesaj, tip });
    };

    const handleGirisEkle = async (yeniGiris) => {
        try {
            const response = await fetch('/api/gunluk-girisler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    ...yeniGiris
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Giriş kaydedilemedi.');
            }

            const sunucudanGelenYeniGiris = await response.json();
            
            setGirisler([sunucudanGelenYeniGiris, ...girisler]);
            handleBildirimGoster("Bugünkü ruh haliniz başarıyla kaydedildi!", "basari");

        } catch (err) {
            handleBildirimGoster(err.message, "hata");
        }
    };
 
    const geriGit = () => {
        setGosterilenTarih(prevTarih => {
            const yeniTarih = new Date(prevTarih);
            if (mod === 'hafta') yeniTarih.setDate(yeniTarih.getDate() - 7);
            else yeniTarih.setMonth(yeniTarih.getMonth() - 1);
            return yeniTarih;
        });
        setSeciliGiris(null);
    };
 
    const ileriGit = () => {
        if (!isIleriButonuAktif) return;
        setGosterilenTarih(prevTarih => {
            const yeniTarih = new Date(prevTarih);
            if (mod === 'hafta') yeniTarih.setDate(yeniTarih.getDate() + 7);
            else yeniTarih.setMonth(yeniTarih.getMonth() + 1);
            return yeniTarih;
        });
        setSeciliGiris(null);
    };
 
    const handleModDegistir = (yeniMod) => {
        setMod(yeniMod);
        setGosterilenTarih(new Date());
        setSeciliGiris(null);
    };

    if (!currentUser) {
        return (
            <div className="container my-5">
                <div className="row justify-content-center">
                    <div className="col-lg-8">
                        <div className="card border-0 shadow-lg welcome-card">
                            <div className="card-body p-5 text-center">
                                <div className="mb-4">
                                    <i className="bi bi-heart-pulse-fill text-primary" style={{ fontSize: '4rem' }}></i>
                                </div>
                                <h1 className="display-5 fw-bold mb-3">Psikoblog'a Hoş Geldiniz</h1>
                                <p className="lead text-muted mb-4">
                                    Binlerce kullanıcının deneyimlerini keşfedin, kendi hikayenizi paylaşın ve 
                                    destekleyici bir toplulukla bağlantı kurun.
                                </p>
                                <div className="d-flex gap-3 justify-content-center">
                                    <Link to="/login" className="btn btn-primary btn-lg px-5 py-3 rounded-pill shadow-sm">
                                        <i className="bi bi-box-arrow-in-right me-2"></i>Giriş Yap
                                    </Link>
                                    <Link to="/register" className="btn btn-outline-primary btn-lg px-5 py-3 rounded-pill">
                                        <i className="bi bi-person-plus me-2"></i>Kayıt Ol
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    if (loading) return <div className="text-center my-5"><h3>Veriler Yükleniyor...</h3></div>;
    if (error) return <div className="alert alert-danger text-center my-5">Hata: {error}</div>;

    return (
        <>
            <Bildirim 
                mesaj={bildirim.mesaj} 
                tip={bildirim.tip} 
                onKapat={() => setBildirim({ mesaj: '', tip: '' })} 
            />
            <div className="mood-tracker-container">
                <div className="container">
                    <div className="row g-5">
                        <div className="col-lg-8">
                            <div className="mood-card chart-card">
                                <div className="card-body">
                                    <div className="chart-navigation">
                                        <div className="btn-group mode-toggle">
                                            <button className={`btn btn-outline-primary ${mod === 'ay' ? 'active' : ''}`} onClick={() => handleModDegistir('ay')}>Aylık</button>
                                            <button className={`btn btn-outline-primary ${mod === 'hafta' ? 'active' : ''}`} onClick={() => handleModDegistir('hafta')}>Haftalık</button>
                                        </div>
                                        <div className="date-controls">
                                            <button className="nav-button" onClick={geriGit}>{'<'}</button>
                                            <span className="date-label">{etiket}</span>
                                            <button className="nav-button" onClick={ileriGit} disabled={!isIleriButonuAktif}>{'>'}</button>
                                        </div>
                                    </div>
                                    <div className="chart-container">
                                        <PuanGrafigi 
                                            filtrelenmisGirisler={filtrelenmisGirisler} 
                                            chartTitle={chartTitle}
                                            onBarClick={(giris) => setSeciliGiris(giris)}
                                        />
                                    </div>
                                </div>
                            </div>
                            {seciliGiris && <GirisDetayi giris={seciliGiris} onClose={() => setSeciliGiris(null)} emojiler={emojiler} />}
                        </div>
                        <div className="col-lg-4">
                            <GunlukGirisFormu 
                                onGirisEkle={handleGirisEkle} 
                                onBildirimGoster={handleBildirimGoster}
                                emojiler={emojiler}
                                isBugunGirisYapildi={isBugunGirisYapildi}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default GunlukPuanlama;