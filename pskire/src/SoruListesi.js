import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './css/soruListesi.css'; 
import { useAuth } from './context/AuthContext';

function SoruListesi() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    
    const [aramaTerimi, setAramaTerimi] = useState('');
    const [secilenHastalik, setSecilenHastalik] = useState('');
    const [secilenIlac, setSecilenIlac] = useState('');
    
    const [gosterilecekSorular, setGosterilecekSorular] = useState([]);
    const [tumHastaliklar, setTumHastaliklar] = useState([]);
    const [tumIlaclar, setTumIlaclar] = useState([]);
    const [yukleniyor, setYukleniyor] = useState(true);

    const [activePhotoIndex, setActivePhotoIndex] = useState({});

    const handleSikayetEt = async (soru_id) => {
        if (!currentUser) return;
        
        try {
            const response = await fetch('/api/sorusikayet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    soru_id: soru_id
                })
            });
            
            if (response.ok) {
                alert(` Şikayet Edildi.`);
            } else {
                const error = await response.json();
                alert(error.message || 'Şikayet Edilirken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Şikayet hatası:', err);
            alert('İşlem sırasında bir hata oluştu.');
        }
    }; 
    
    const handleSoruyuKaldir = async (soruId, soruTitle) => {
        if (window.confirm(`'${soruTitle}' başlıklı soruyu kalıcı olarak kaldırmak istediğinize emin misiniz?`)) {
            if (!currentUser) return;

            const orijinalSorular = [...gosterilecekSorular];
            setGosterilecekSorular(prevSorular => prevSorular.filter(s => s.id !== soruId));

            try {
                const kaldiran_id = currentUser.id;
                const response = await fetch(`/api/sorusil/${soruId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kaldiran_id: kaldiran_id, kaldiran_rol: currentUser.rol })
                });

                if (!response.ok) {
                    alert('Soru sunucudan kaldırılamadı, değişiklik geri alınıyor.');
                    setGosterilecekSorular(orijinalSorular);
                } else {
                    alert("Soru başarıyla kaldırıldı ve şikayetiniz yönetime iletildi.");
                }

            } catch (err) {
                console.error('Soru kaldırma hatası:', err);
                alert('Bir sunucu hatası oluştu, değişiklik geri alınıyor.');
                setGosterilecekSorular(orijinalSorular);
            }
        }
    };
    
    const getProfilPath = (userId) => (currentUser?.id === userId ? '/profilim' : `/profil/${userId}`);
    const formatDate = (date) => new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

    // YENİ FONKSİYONLAR: Fotoğraf kaydırma
    const handleNextPhoto = (soruId, currentPhotos) => {
        const currentIndex = activePhotoIndex[soruId] || 0;
        const nextIndex = (currentIndex + 1) % currentPhotos.length;
        setActivePhotoIndex(prev => ({ ...prev, [soruId]: nextIndex }));
    };

    const handlePrevPhoto = (soruId, currentPhotos) => {
        const currentIndex = activePhotoIndex[soruId] || 0;
        const prevIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
        setActivePhotoIndex(prev => ({ ...prev, [soruId]: prevIndex }));
    };

    useEffect(() => {
        const fetchSorular = async () => {
            setYukleniyor(true);
            const params = new URLSearchParams();
            if (aramaTerimi) params.append('aramaTerimi', aramaTerimi);
            if (secilenHastalik) params.append('secilenHastalik', secilenHastalik);
            if (secilenIlac) params.append('secilenIlac', secilenIlac);

            try {
                const response = await fetch(`/api/sorularlistesi?${params.toString()}`);
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    if (!response.ok) throw new Error(data.message || 'Veri çekilemedi');
                    
                    setGosterilecekSorular(data.sorular);
                    setTumHastaliklar(data.tumHastaliklar);
                    setTumIlaclar(data.tumIlaclar);
                } catch (jsonError) {
                    console.error("JSON parse hatası:", text);
                    throw new Error("Sunucudan geçerli bir JSON cevabı alınamadı.");
                }

            } catch (error) {
                console.error("Sorular çekilirken hata oluştu:", error);
                setGosterilecekSorular([]);
            } finally {
                setYukleniyor(false);
            }
        };

        const timerId = setTimeout(() => {
            fetchSorular();
        }, 500); 

        return () => clearTimeout(timerId); 

    }, [aramaTerimi, secilenHastalik, secilenIlac]); 

    return (
        <div className="container soru-listesi-container">
            <div className="d-flex justify-content-between align-items-center mb-5 pb-3 border-bottom">
                <div>
                    <h1 className="sayfa-baslik mb-0"><i className="bi bi-chat-quote me-3"></i>Topluluk Soruları</h1>
                    <p className="text-muted mt-2 mb-0"><i className="bi bi-people-fill me-2"></i>{gosterilecekSorular.length} soru bulundu</p>
                </div>
                <Link to="/soru-sor" className="btn yeni-soru-btn"><i className="bi bi-plus-circle-fill me-2"></i>Yeni Soru Sor</Link>
            </div>

            <div className="card filtre-karti">
                <div className="card-body">
                    <h5 className="card-title mb-3"><i className="bi bi-funnel-fill me-2"></i>Filtrele</h5>
                    <div className="row g-3 align-items-center">
                        <div className="col-md-5"><div className="form-floating">
                            <select className="form-select" id="hastalikSelect" value={secilenHastalik} onChange={e => setSecilenHastalik(e.target.value)}>
                                <option value="">Tüm Hastalıklar</option>
                                {tumHastaliklar.map(h => <option key={h.id} value={h.id}>{h.illness_name}</option>)}
                            </select>
                            <label htmlFor="hastalikSelect"><i className="bi bi-virus me-2"></i>Hastalık Seçin</label>
                        </div></div>
                        <div className="col-md-5"><div className="form-floating">
                            <select className="form-select" id="ilacSelect" value={secilenIlac} onChange={e => setSecilenIlac(e.target.value)}>
                                <option value="">Tüm İlaçlar</option>
                                {tumIlaclar.map(i => <option key={i.id} value={i.id}>{i.medicine_name}</option>)}
                            </select>
                            <label htmlFor="ilacSelect"><i className="bi bi-capsule me-2"></i>İlaç Seçin</label>
                        </div></div>
                        <div className="col-md-2 d-grid">
                            <button className='btn btn-outline-danger h-100' onClick={() => { setSecilenHastalik(''); setSecilenIlac(''); setAramaTerimi(''); }}>
                                <i className="bi bi-x-circle me-2"></i>Temizle
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="input-group arama-kutusu mb-5">
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input type="search" className="form-control form-control-lg" placeholder="Soru başlıklarında, içeriklerinde ve yorumlarda ara..." value={aramaTerimi} onChange={e => setAramaTerimi(e.target.value)} />
            </div>
            
            {yukleniyor ? (
                <div className="text-center py-5"><div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}} role="status"><span className="visually-hidden">Yükleniyor...</span></div></div>
            ) : (
                <div className="row g-4">
                    {gosterilecekSorular.length === 0 ? (
                        <div className="col-12 text-center py-5"><i className="bi bi-info-circle-fill display-4 text-secondary mb-3"></i><h5>Sonuç Bulunamadı</h5><p className="mb-0">Bu kriterlere uygun bir soru bulunamadı.</p></div>
                    ) : (
                        gosterilecekSorular.map((soru) => {
                            const isAnonymous = soru.is_anonymous;
                            const soruSahibi = { name: soru.user_name, surname: soru.user_surname };
                            const soruSahibiRolu = soru.user_role || 'kullanici';
                            
                            const isMyQuestion = currentUser?.id === soru.user_id;
                            const questionOwnerIsAdmin = soruSahibiRolu === 'admin';
                            const canShowReportButton = currentUser?.rol === 'kullanici' && !isMyQuestion;
                            const canShowRemoveButton = isMyQuestion || (currentUser?.rol === 'admin') || (currentUser?.rol === 'moderator' && !questionOwnerIsAdmin);
                            const canShowMenu = canShowReportButton || canShowRemoveButton;

                            const currentPhotoIndex = activePhotoIndex[soru.id] || 0;
                            const currentPhoto = soru.fotograflar[currentPhotoIndex];
                            const photoUrl = currentPhoto ? `data:image/jpeg;base64,${currentPhoto.image}` : null;
                            
                            return (
                                <div key={soru.id} className="col-12">
                                    <div className="card soru-karti">
                                        <div className="card-body p-4">
                                            <div className="d-flex justify-content-between align-items-start mb-3">
                                                <div className="flex-grow-1">
                                                    <Link to={`/sorular/${soru.id}`} className="text-decoration-none stretched-link">
                                                        <h4 className="soru-karti-baslik mb-1">{soru.title}</h4>
                                                    </Link>
                                                    <div className="d-flex align-items-center gap-3 text-muted small">
                                                        <span><i className="bi bi-calendar3 me-1"></i>{formatDate(soru.date)}</span>
                                                        <span><i className="bi bi-chat-dots me-1"></i>{soru.comment_count} yorum</span>
                                                    </div>
                                                </div>
                                                {canShowMenu && (
                                                    <div className="dropdown" style={{position: 'relative', zIndex: 2}} onClick={e => e.stopPropagation()}>
                                                        <button className="btn btn-light btn-sm rounded-circle p-2" type="button" data-bs-toggle="dropdown" aria-expanded="false"><i className="bi bi-three-dots-vertical"></i></button>
                                                        <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
                                                            {canShowReportButton && (<li><button className="dropdown-item" onClick={(e) => { e.preventDefault(); handleSikayetEt(soru.id, soru.title)}}><i className="bi bi-flag-fill me-2 text-warning"></i>Şikayet Et</button></li>)}
                                                            {canShowRemoveButton && (<li><button className="dropdown-item text-danger" onClick={(e) => { e.preventDefault(); handleSoruyuKaldir(soru.id, soru.title)}}><i className="bi bi-trash-fill me-2"></i>Soruyu Kaldır</button></li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {soru.fotograflar.length > 0 && (
                                                <div className="fotograf-galeri-container mb-3">
                                                    <img src={photoUrl} alt="Soru Fotoğrafı" className="galeri-fotografi" />
                                                    {soru.fotograflar.length > 1 && (
                                                        <>
                                                            <button className="galeri-btn galeri-btn-prev" onClick={(e) => { e.preventDefault(); handlePrevPhoto(soru.id, soru.fotograflar); }}>
                                                                <i className="bi bi-chevron-left"></i>
                                                            </button>
                                                            <button className="galeri-btn galeri-btn-next" onClick={(e) => { e.preventDefault(); handleNextPhoto(soru.id, soru.fotograflar); }}>
                                                                <i className="bi bi-chevron-right"></i>
                                                            </button>
                                                            <div className="foto-sayac">
                                                                {currentPhotoIndex + 1} / {soru.fotograflar.length}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            <p className="card-text text-muted mb-3">{soru.content.substring(0,200)}{soru.content.length > 200 && '...'}</p>

                                            <div className="d-flex flex-wrap justify-content-between align-items-center pt-3 kart-footer">
                                                <div className="d-flex align-items-center mb-2 mb-md-0">
                                                    {isAnonymous ? (
                                                        <><div className="avatar-daire bg-secondary me-2"><i className="bi bi-incognito"></i></div><div><small className="text-muted">Paylaşan:</small><div className="fw-semibold">Anonim Kullanıcı</div></div></>
                                                    ) : (
                                                        <><div className="avatar-daire me-2" style={{backgroundColor: '#6c5ce7'}}>{soruSahibi.name.charAt(0).toUpperCase()}</div><div><small className="text-muted">Paylaşan:</small><div className="fw-semibold text-primary avatar-isim" style={{cursor:'pointer'}} onClick={(e) => { e.preventDefault(); navigate(getProfilPath(soru.user_id)); }}>{soruSahibi.name} {soruSahibi.surname}</div></div></>
                                                    )}
                                                </div>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {soru.ilgiliHastaliklar.map(h => <span key={`h-${h.id}`} className="badge etiket hastalik-etiket"><i className="bi bi-virus me-1"></i>{h.illness_name}</span>)}
                                                    {soru.ilgiliIlaclar.map(i => <span key={`i-${i.id}`} className="badge etiket ilac-etiket"><i className="bi bi-capsule me-1"></i>{i.medicine_name}</span>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

export default SoruListesi;