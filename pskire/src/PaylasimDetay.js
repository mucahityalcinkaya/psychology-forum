import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './css/PaylasimDetay.css';
import Swal from 'sweetalert2';

function PaylasimDetay() {
    const { currentUser } = useAuth();
    const { paylasimId } = useParams();
    const navigate = useNavigate();

    const [paylasimVerisi, setPaylasimVerisi] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hata, setHata] = useState(null);
    const sikayetid = 1;

    // FOTOĞRAF KARIŞMA SİSTEMİ İÇİN YENİ STATE'LER
    const [fotograflar, setFotograflar] = useState([]);
    const [aktifFotoIndex, setAktifFotoIndex] = useState(0);

    const handleSikayetEt = async (paylasim_id, paylasim_title) => {
        if (!currentUser) return;

        try {
            const response = await fetch('/api/paylasimsikayet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    paylasim_id: paylasim_id,
                    sikayetid: sikayetid
                })
            });

            if (response.ok) {
                alert(` ${paylasim_title} başlıklı gönderi Şikayet Edildi.`);
            } else {
                const error = await response.json();
                alert(error.message || 'Şikayet Edilirken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Şikayet hatası:', err);
            alert('İşlem sırasında bir hata oluştu.');
        }
    };

    const handleGonderiyiKaldir = async () => {
        if (!currentUser) return;

        const confirmDelete = window.confirm(`'${paylasimVerisi.paylasim.title}' başlıklı Paylaşımı kalıcı olarak kaldırmak istediğinize emin misiniz?`);
        if (!confirmDelete) return;

        try {
            const response = await fetch(`/api/paylasimsil/${paylasimVerisi.paylasim.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kaldiran_id: currentUser.id,
                    kaldiran_rol: currentUser.rol
                })
            });

            if (response.ok) {
                alert('Paylaşım başarıyla kaldırıldı!');
                navigate(`/main`);
            } else if (response.status === 403) {
                alert('Bu Paylaşımı kaldırma yetkiniz yok.');
            }
        } catch (error) {
            console.error('Paylaşım kaldırılırken hata:', error);
            alert('Paylaşım kaldırılırken bir hata oluştu.');
        }
    };

    useEffect(() => {
        const fetchPaylasimDetay = async () => {
            try {
                const response = await fetch(`/api/paylasimdetay/${paylasimId}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Paylaşım verisi alınamadı.');
                }
                
                setPaylasimVerisi(data);
                if (data.fotograflar && data.fotograflar.length > 0) {
                    setFotograflar(data.fotograflar);
                }

            } catch (err) {
                setHata(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPaylasimDetay();
    }, [paylasimId]);

    const getProfilPath = (targetUserId) => {
        if (currentUser && currentUser.id === targetUserId) { return '/profilim'; }
        return `/profil/${targetUserId}`;
    };

    // FOTOĞRAF KAYDIRMA FONKSİYONLARI
    const handleNextPhoto = () => {
        setAktifFotoIndex((prevIndex) => (prevIndex + 1) % fotograflar.length);
    };

    const handlePrevPhoto = () => {
        setAktifFotoIndex((prevIndex) => (prevIndex - 1 + fotograflar.length) % fotograflar.length);
    };

    if (loading) return <div className="text-center my-5"><h2>Paylaşım Yükleniyor...</h2></div>;
    if (hata) return <div className="alert alert-danger text-center my-5">{hata}</div>;
    if (!paylasimVerisi || !paylasimVerisi.paylasim) return <div className="text-center my-5">Paylaşım verisi bulunamadı.</div>;

    const { paylasim, ilaclar, yanetkiler } = paylasimVerisi;

    const isMyPost = currentUser?.id === paylasim.user_id;
    const postOwnerIsAdmin = paylasim.user_role === 'admin';
    const canShowReportButton = currentUser?.rol === 'kullanici' && !isMyPost;
    const canShowRemoveButton = isMyPost || (currentUser?.rol === 'admin') || (currentUser?.rol === 'moderator' && !postOwnerIsAdmin);
    const canShowMenu = canShowReportButton || canShowRemoveButton;

    const activePhoto = fotograflar[aktifFotoIndex];

    return (
        <div className="paylasim-detay-container">
            <div className="container">
                <div className="d-flex align-items-center mb-4">
                    <Link to={`/main`} className="btn geri-butonu me-2"><i className="bi bi-arrow-left"></i> Ana Menü</Link>
                    <Link to={`/hastaliklar/${paylasim.hastalik_slug}`} className="btn geri-butonu">
                        <i className="bi bi-arrow-left"></i> {paylasim.hastalik_name} Deneyimleri
                    </Link>
                </div>

                <div className="card paylasim-karti">
                    <div className="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <h1 className="h3 mb-1 paylasim-baslik">{paylasim.title}</h1>
                            <small className="text-muted">
                                {paylasim.is_anonymous ? (
                                    <>Paylaşan: <strong className="fw-bold">Anonim</strong></>
                                ) : (
                                    <>Paylaşan: 
                                        <Link to={getProfilPath(paylasim.user_id)} className="ms-1 text-decoration-none fw-bold">
                                            {paylasim.user_name} {paylasim.user_surname}
                                        </Link>
                                    </>
                                )}
                            </small>
                        </div>

                        {canShowMenu && (
                            <div className="dropdown ms-3">
                                <button className="btn btn-light" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end">
                                    {canShowReportButton && (
                                        <li><button className="dropdown-item" onClick={() => handleSikayetEt(paylasim.id, paylasim.title)}><i className="bi bi-flag-fill me-2"></i>Şikayet Et</button></li>
                                    )}
                                    {canShowRemoveButton && (
                                        <li><button className="dropdown-item text-danger" onClick={() => handleGonderiyiKaldir(paylasim.id, paylasim.title)}><i className="bi bi-trash-fill me-2"></i>Gönderiyi Kaldır</button></li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="card-body">
                        {fotograflar.length > 0 && (
                            <div className="fotograf-galeri-container mb-3">
                                <img src={`data:image/jpeg;base64,${activePhoto.image}`} alt="Paylaşım Fotoğrafı" className="galeri-fotografi" />
                                {fotograflar.length > 1 && (
                                    <>
                                        <button className="galeri-btn galeri-btn-prev" onClick={handlePrevPhoto}>
                                            <i className="bi bi-chevron-left"></i>
                                        </button>
                                        <button className="galeri-btn galeri-btn-next" onClick={handleNextPhoto}>
                                            <i className="bi bi-chevron-right"></i>
                                        </button>
                                        <div className="foto-sayac">
                                            {aktifFotoIndex + 1} / {fotograflar.length}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <p className="paylasim-icerik">{paylasim.content}</p>
                        <hr className="my-4" />

                        <h4 className="mb-3 detay-bolum-baslik">Kullanılan İlaçlar</h4>
                        {ilaclar.length > 0 ? (
                            <ul className="detay-listesi">{ilaclar.map(ilac => (<li key={ilac.id}><strong>{ilac.medicine_name}:</strong> {ilac.aciklama}</li>))}</ul>
                        ) : (<p className="text-muted">Bu deneyimde belirtilen bir ilaç yok.</p>)}

                        <hr className="my-4" />
                        <h4 className="mb-3 detay-bolum-baslik">Görülen Yan Etkiler</h4>
                        {yanetkiler.length > 0 ? (
                            <ul className="detay-listesi">{yanetkiler.map(yanetki => (<li key={yanetki.id}><strong>{yanetki.sideeffects_name}:</strong> {yanetki.aciklama}</li>))}</ul>
                        ) : (<p className="text-muted">Bu deneyimde belirtilen bir yan etki yok.</p>)}
                    </div>

                    <div className="card-footer text-muted text-end">
                        Paylaşım Tarihi: {new Date(paylasim.date).toLocaleDateString('tr-TR')}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PaylasimDetay;