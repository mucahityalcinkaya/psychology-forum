import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import './css/HastalikDetay.css';

function HastalikDetay() {
    const { currentUser } = useAuth();
    const { hastalikSlug } = useParams();

    const [secilenHastalik, setSecilenHastalik] = useState(null);
    const [tumPaylasimlar, setTumPaylasimlar] = useState([]);
    const [tumPaylasimIlac, setTumPaylasimIlac] = useState([]);
    const [tumPaylasimYanetki, setTumPaylasimYanetki] = useState([]);
    const [tumPaylasimFotograflar, setTumPaylasimFotograflar] = useState([]);
    const [tumKullanicilar, setTumKullanicilar] = useState([]);
    const [tumAnonimPaylasimlar, setTumAnonimPaylasimlar] = useState([]);
    const [tumRoller, setTumRoller] = useState([]);
    const [tumUserRoller, setTumUserRoller] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openSections, setOpenSections] = useState({});
    const [aramaTerimi, setAramaTerimi] = useState('');
    const [seciliIlacId, setSeciliIlacId] = useState('');
    const [seciliYanetkiId, setSeciliYanetkiId] = useState('');
    const sikayetid = 1;

    const [activePhotoIndex, setActivePhotoIndex] = useState({});

    useEffect(() => {
        const fetchHastalikDetay = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/hastaliklar/${hastalikSlug}/detaylar`);
                if (!response.ok) {
                    throw new Error('Veri çekilirken bir sorun oluştu.');
                }
                const data = await response.json();

                setSecilenHastalik(data.hastalik);
                setTumPaylasimIlac(data.paylasimIlac);
                setTumPaylasimYanetki(data.paylasimYanetki);
                setTumPaylasimFotograflar(data.paylasimFotograflar);
                setTumKullanicilar(data.kullanicilar);
                setTumAnonimPaylasimlar(data.anonimPaylasimlar);
                setTumRoller(data.roller);
                setTumUserRoller(data.userRoller);

                const kaldirilanPaylasimIdleri = new Set(
                    data.kaldirilanlar.filter(k => k.sikayet_anaid === 1).map(k => k.kaldirma_id)
                );
                const paylasimlar = data.paylasimlar.filter(p => !kaldirilanPaylasimIdleri.has(p.id));
                setTumPaylasimlar(paylasimlar);
                setLoading(false);

            } catch (err) {
                console.error("API hatası:", err);
                setError("Veriler yüklenirken bir hata oluştu.");
                setLoading(false);
            }
        };

        fetchHastalikDetay();
    }, [hastalikSlug]);

    const handleSikayetEt = async (paylasim_id, paylasim_title, sikayetid) => {
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
                alert(`'${paylasim_title}' başlıklı gönderi Şikayet Edildi.`);
            } else {
                const error = await response.json();
                alert(error.message || 'Şikayet Edilirken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Şikayet hatası:', err);
            alert('İşlem sırasında bir hata oluştu.');
        }
    };

    const handleGonderiyiKaldir = async (paylasimId, paylasimTitle) => {
        if (!currentUser) return;

        const confirmDelete = window.confirm(`'${paylasimTitle}' başlıklı Paylaşımı kalıcı olarak kaldırmak istediğinize emin misiniz?`);
        if (!confirmDelete) return;

        try {
            const response = await fetch(`/api/paylasimsil/${paylasimId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kaldiran_id: currentUser.id,
                    kaldiran_rol: currentUser.rol
                })
            });

            if (response.ok) {
                alert('Paylaşım başarıyla kaldırıldı!');
                setTumPaylasimlar(tumPaylasimlar =>
                    tumPaylasimlar.filter(paylasim => paylasim.id !== paylasimId)
                );
            } else if (response.status === 403) {
                alert('Bu Paylaşımı kaldırma yetkiniz yok.');
            }
        } catch (error) {
            console.error('Paylaşım kaldırılırken hata:', error);
            alert('Paylaşım kaldırılırken bir hata oluştu.');
        }
    };

    const handleNextPhoto = (paylasimId, currentPhotos) => {
        const currentIndex = activePhotoIndex[paylasimId] || 0;
        const nextIndex = (currentIndex + 1) % currentPhotos.length;
        setActivePhotoIndex(prev => ({ ...prev, [paylasimId]: nextIndex }));
    };

    const handlePrevPhoto = (paylasimId, currentPhotos) => {
        const currentIndex = activePhotoIndex[paylasimId] || 0;
        const prevIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
        setActivePhotoIndex(prev => ({ ...prev, [paylasimId]: prevIndex }));
    };

    const getProfilPath = (userId) => currentUser?.id === userId ? '/profilim' : `/profil/${userId}`;
    const getUserNameById = (userId) => {
        const kullanici = tumKullanicilar?.find(user => user.id === userId);
        return kullanici ? `${kullanici.name} ${kullanici.surname}` : 'Bilinmeyen Kullanıcı';
    };

    const availableIlaclar = useMemo(() => {
        const relatedPaylasimIds = new Set(tumPaylasimlar.map(p => p.id));
        const relevantIlacEntries = tumPaylasimIlac.filter(pi => relatedPaylasimIds.has(pi.paylasim_id));
        const uniqueIlaclar = new Map();
        relevantIlacEntries.forEach(ilac => {
            if (!uniqueIlaclar.has(ilac.id)) {
                uniqueIlaclar.set(ilac.id, ilac);
            }
        });
        return Array.from(uniqueIlaclar.values());
    }, [tumPaylasimlar, tumPaylasimIlac]);

    const availableYanetkiler = useMemo(() => {
        const relatedPaylasimIds = new Set(tumPaylasimlar.map(p => p.id));
        const relevantYanetkiEntries = tumPaylasimYanetki.filter(py => relatedPaylasimIds.has(py.paylasim_id));
        const uniqueYanetkiler = new Map();
        relevantYanetkiEntries.forEach(yanetki => {
            if (!uniqueYanetkiler.has(yanetki.id)) {
                uniqueYanetkiler.set(yanetki.id, yanetki);
            }
        });
        return Array.from(uniqueYanetkiler.values());
    }, [tumPaylasimlar, tumPaylasimYanetki]);

    const gosterilecekPaylasimlar = useMemo(() => {
        const sorgu = aramaTerimi.toLowerCase().trim();
        return tumPaylasimlar
            .map(paylasim => {
                const ilaclar = tumPaylasimIlac.filter(pi => pi.paylasim_id === paylasim.id);
                const yanetkiler = tumPaylasimYanetki.filter(py => py.paylasim_id === paylasim.id);
                const fotograflar = tumPaylasimFotograflar.filter(f => f.gonderi_id === paylasim.id);

                const userRoleEntry = tumUserRoller?.find(ur => ur.user_id === paylasim.user_id);
                let paylasimSahibiRolu = 'kullanici';
                if (userRoleEntry) {
                    const rolDetayi = tumRoller?.find(r => r.id === userRoleEntry.rol_id);
                    paylasimSahibiRolu = rolDetayi?.rol_ad || 'kullanici';
                }

                const aramaKosulu = !sorgu ||
                    paylasim.title.toLowerCase().includes(sorgu) ||
                    paylasim.content.toLowerCase().includes(sorgu) ||
                    ilaclar.some(ilac => (ilac.medicine_name && ilac.medicine_name.toLowerCase().includes(sorgu)) || (ilac.content && ilac.content.toLowerCase().includes(sorgu))) ||
                    yanetkiler.some(yanetki => (yanetki.sideeffects_name && yanetki.sideeffects_name.toLowerCase().includes(sorgu)) || (yanetki.content && yanetki.content.toLowerCase().includes(sorgu)));

                const ilacFiltreKosulu = !seciliIlacId || ilaclar.some(ilac => ilac.id.toString() === seciliIlacId);
                const yanetkiFiltreKosulu = !seciliYanetkiId || yanetkiler.some(yanetki => yanetki.id.toString() === seciliYanetkiId);

                if (aramaKosulu && ilacFiltreKosulu && yanetkiFiltreKosulu) {
                    return { paylasim, ilaclar, yanetkiler, fotograflar, paylasimSahibiRolu };
                }
                return null;
            }).filter(Boolean);
    }, [aramaTerimi, seciliIlacId, seciliYanetkiId, tumPaylasimlar, tumPaylasimIlac, tumPaylasimYanetki, tumPaylasimFotograflar, tumUserRoller, tumRoller]);

    const toggleSection = (sectionId) => setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
    const resetFilters = () => { setAramaTerimi(''); setSeciliIlacId(''); setSeciliYanetkiId(''); setOpenSections({}); };

    if (loading) return <div className="text-center my-5">Yükleniyor...</div>;
    if (error) return <div className="text-center my-5 text-danger">{error}</div>;
    if (!secilenHastalik) return <div className="text-center my-5">Hastalık bilgisi bulunamadı.</div>;

    return (
        <div className="hastalik-detay-container">
            <div className="container">
                <div className="d-flex justify-content-between align-items-center mb-4 sayfa-baslik-alani">
                    <div className="d-flex align-items-center">
                        <Link to="/" className="btn geri-butonu me-3"><i className="bi bi-arrow-left"></i> Geri</Link>
                        <h1 className="h2 mb-0 sayfa-baslik">{secilenHastalik.illness_name} İçin Deneyimler</h1>
                    </div>
                     {currentUser &&
                    <Link to={`/paylasim-yap/${hastalikSlug}`} className="btn paylasim-yap-btn"><i className="bi bi-plus-lg me-2"></i> Paylaşım Yap</Link> }
                </div>

                <div className="card filtre-karti mb-4">
                    <div className="row g-3">
                        <div className="col-md-4"><select className="form-select" value={seciliIlacId} onChange={e => setSeciliIlacId(e.target.value)}><option value="">Tüm İlaçlar</option>{availableIlaclar.map(ilac => ilac && <option key={ilac.id} value={ilac.id}>{ilac.medicine_name}</option>)}</select></div>
                        <div className="col-md-4"><select className="form-select" value={seciliYanetkiId} onChange={e => setSeciliYanetkiId(e.target.value)}><option value="">Tüm Yan Etkiler</option>{availableYanetkiler.map(yanetki => yanetki && <option key={yanetki.id} value={yanetki.id}>{yanetki.sideeffects_name}</option>)}</select></div>
                        <div className="col-md-2 d-grid"><button onClick={resetFilters} className="btn btn-outline-danger"><i className="bi bi-x-circle me-2"></i>Temizle</button></div>
                        <div className="col-md-2 d-grid"><span className="btn btn-light text-muted w-100">{gosterilecekPaylasimlar.length} sonuç</span></div>
                        <div className="col-12 mt-3"><input type="text" className="form-control" placeholder="Deneyim başlığı, içerik, ilaç veya yan etki ara..." value={aramaTerimi} onChange={e => setAramaTerimi(e.target.value)} /></div>
                    </div>
                </div>

                {gosterilecekPaylasimlar.length === 0 ? (<div className="uyari-kutusu">Aradığınız kriterlere uygun bir deneyim bulunamadı.</div>) :
                    (
                        gosterilecekPaylasimlar.map(({ paylasim, ilaclar, yanetkiler, fotograflar, paylasimSahibiRolu }) => {
                            const isAnonymous = tumAnonimPaylasimlar.some(anon => anon.paylasim_id === paylasim.id);
                            const ilaclarSectionId = `paylasim-${paylasim.id}-ilaclar`;
                            const yanetkilerSectionId = `paylasim-${paylasim.id}-yanetkiler`;
                            const isMyPost = currentUser?.id === paylasim.user_id;
                            const postOwnerIsAdmin = paylasimSahibiRolu === 'admin';
                            const canShowReportButton = currentUser?.rol === 'kullanici' && !isMyPost;
                            const canShowRemoveButton = isMyPost || (currentUser?.rol === 'admin') || (currentUser?.rol === 'moderator' && !postOwnerIsAdmin);
                            const canShowMenu = canShowReportButton || canShowRemoveButton;

                            const currentPhotoIndex = activePhotoIndex[paylasim.id] || 0;
                            const currentPhoto = fotograflar[currentPhotoIndex];
                            // DÜZELTME: photoUrl'yi Base64'e dönüştürerek oluşturma
                            const photoUrl = currentPhoto ? `data:image/jpeg;base64,${currentPhoto.image}` : null;
                            
                            return (
                                <div key={paylasim.id} className="card paylasim-karti mb-4">
                                    <div className="card-header p-3 d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0">{paylasim.title}</h5>
                                        <div className="d-flex align-items-center">
                                            {isAnonymous ? <small className="text-muted">Paylaşan: <strong className="fw-bold">Anonim</strong></small> : <small className="text-muted">Paylaşan: <Link to={getProfilPath(paylasim.user_id)} className="ms-1 text-decoration-none fw-bold">{getUserNameById(paylasim.user_id)}</Link></small>}
                                            {canShowMenu && (
                                                <div className="dropdown ms-3">
                                                    <button className="btn btn-sm btn-light" type="button" data-bs-toggle="dropdown"><i className="bi bi-three-dots-vertical"></i></button>
                                                    <ul className="dropdown-menu dropdown-menu-end">
                                                        {canShowReportButton && <li><button className="dropdown-item" onClick={() => handleSikayetEt(paylasim.id, paylasim.title, sikayetid)}><i className="bi bi-flag-fill me-2"></i>Şikayet Et</button></li>}
                                                        {canShowRemoveButton && <li><button className="dropdown-item text-danger" onClick={() => handleGonderiyiKaldir(paylasim.id, paylasim.title)}><i className="bi bi-trash-fill me-2"></i>Gönderiyi Kaldır</button></li>}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="card-body p-4">
                                        <p className="card-text">{paylasim.content}</p>

                                        {fotograflar.length > 0 && (
                                            <div className="fotograf-galeri-container mt-3">
                                                <img src={photoUrl} alt="Paylaşım Fotoğrafı" className="galeri-fotografi" />
                                                {fotograflar.length > 1 && (
                                                    <>
                                                        <button className="galeri-btn galeri-btn-prev" onClick={() => handlePrevPhoto(paylasim.id, fotograflar)}>
                                                            <i className="bi bi-chevron-left"></i>
                                                        </button>
                                                        <button className="galeri-btn galeri-btn-next" onClick={() => handleNextPhoto(paylasim.id, fotograflar)}>
                                                            <i className="bi bi-chevron-right"></i>
                                                        </button>
                                                        <div className="foto-sayac">
                                                            {currentPhotoIndex + 1} / {fotograflar.length}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                    </div>
                                    <div className="list-group list-group-flush">
                                        {ilaclar.length > 0 && (<>
                                            <a href={`#${ilaclarSectionId}`} className="list-group-item list-group-item-action" onClick={e => { e.preventDefault(); toggleSection(ilaclarSectionId); }}>KULLANILAN İLAÇLAR <i className={`bi bi-chevron-down float-end transition-transform ${openSections[ilaclarSectionId] ? 'rotate-180' : ''}`}></i></a>
                                            <div className={`collapse ${openSections[ilaclarSectionId] ? 'show' : ''}`} id={ilaclarSectionId}><ul className="list-group list-group-flush ps-3">{ilaclar.map(ilac => ilac && <li key={ilac.id} className="list-group-item"><strong>{ilac.medicine_name}:</strong> {ilac.content}</li>)}</ul></div>
                                        </>)}
                                        {yanetkiler.length > 0 && (<>
                                            <a href={`#${yanetkilerSectionId}`} className="list-group-item list-group-item-action" onClick={e => { e.preventDefault(); toggleSection(yanetkilerSectionId); }}>GÖRÜLEN YAN ETKİLER <i className={`bi bi-chevron-down float-end transition-transform ${openSections[yanetkilerSectionId] ? 'rotate-180' : ''}`}></i></a>
                                            <div className={`collapse ${openSections[yanetkilerSectionId] ? 'show' : ''}`} id={yanetkilerSectionId}><ul className="list-group list-group-flush ps-3">{yanetkiler.map(yanetki => yanetki && <li key={yanetki.id} className="list-group-item"><strong>{yanetki.sideeffects_name}:</strong> {yanetki.content}</li>)}</ul></div>
                                        </>)}
                                    </div>
                                </div>
                            );
                        })
                    )}
            </div>
        </div>
    );
}

export default HastalikDetay;