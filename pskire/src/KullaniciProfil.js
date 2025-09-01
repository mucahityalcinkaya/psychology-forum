import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './css/KullaniciProfil.css';

// Bootstrap modal bileşenini kullanmak için gerekli import'ları ekliyoruz
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

function KullaniciProfil() {
    const { userId } = useParams(); 
    const { currentUser } = useAuth();
    const [profilKullanici, setProfilKullanici] = useState(null);
    
    const [paylasimlar, setPaylasimlar] = useState([]);
    const [sorular, setSorular] = useState([]); 
    const [roller, setRoller] = useState([]);

    const [aktifSekme, setAktifSekme] = useState('paylasimlar');
    const [isFollowing, setIsFollowing] = useState(false);
    const [takipciSayisi, setTakipciSayisi] = useState(0);
    const [takipEdilenSayisi, setTakipEdilenSayisi] = useState(0);

    // Yeni state'ler: Modal ve sebep inputu için
    const [showUyariModal, setShowUyariModal] = useState(false);
    const [showBanModal, setShowBanModal] = useState(false);
    const [sebep, setSebep] = useState('');

    useEffect(() => {
        const tumVerileriCek = async () => {
            if (!userId) {
                setProfilKullanici(null);
                return;
            }

            try {
                const profilId = parseInt(userId);

                // Her zaman çekilmesi gereken veriler
                const [
                    profilKullaniciRes, 
                    takipSayilariRes, 
                    icerikCevabi
                ] = await Promise.all([
                    fetch(`http://localhost:5000/api/kullanicilar/${profilId}`),
                    fetch(`http://localhost:5000/api/kullanicilar/${profilId}/takip-sayilari`),
                    fetch(`http://localhost:5000/api/kullanicipves/${currentUser ? currentUser.id : 0}/${profilId}`)
                ]);

                if (!profilKullaniciRes.ok) throw new Error(`Profil bilgisi API isteği başarısız: ${profilKullaniciRes.status}`);
                if (!takipSayilariRes.ok) throw new Error(`Takip sayıları API isteği başarısız: ${takipSayilariRes.status}`);
                if (!icerikCevabi.ok) throw new Error(`İçerik API isteği başarısız: ${icerikCevabi.status}`);

                const [profilKullaniciData, takipSayilariData, icerikVerisi] = await Promise.all([
                    profilKullaniciRes.json(),
                    takipSayilariRes.json(),
                    icerikCevabi.json()
                ]);

                setProfilKullanici(profilKullaniciData);
                setTakipciSayisi(takipSayilariData.takipciSayisi);
                setTakipEdilenSayisi(takipSayilariData.takipEdilenSayisi);
                setPaylasimlar(icerikVerisi.paylasimlar || []);
                setSorular(icerikVerisi.sorular || []);

                // Sadece giriş yapmış kullanıcılar için ekstra verileri çek
                if (currentUser) {
                    try {
                        const [isFollowingRes, rollerRes] = await Promise.all([
                            fetch(`http://localhost:5000/api/takipediyormu/${profilId}/${parseInt(currentUser.id)}`),
                            fetch(`http://localhost:5000/api/roller`)
                        ]);
                        
                        if (isFollowingRes.ok) {
                            const isFollowingData = await isFollowingRes.json();
                            setIsFollowing(isFollowingData.isFollowing);
                        } else {
                            console.error("Takip durumu çekilirken hata oluştu.");
                        }

                        if (rollerRes.ok) {
                            const rollerData = await rollerRes.json();
                            setRoller(rollerData || []);
                        } else {
                            console.error("Roller çekilirken hata oluştu.");
                        }
                    } catch (error) {
                        console.error("Yetki/Takip verilerini çekerken hata:", error);
                    }
                }
            } catch (error) {
                console.error("Profil verilerini çekerken bir hata oluştu:", error);
                setProfilKullanici(null);
            }
        };

        tumVerileriCek();
    }, [userId, currentUser]);
    
    if (!profilKullanici) {
        return <div className="text-center my-5">Kullanıcı bulunamadı veya yükleniyor...</div>;
    }

    const handleToggleTakip = () => {
        if (!currentUser) {
            alert('Bu işlemi yapmak için giriş yapmalısınız.');
            return;
        }
        if (isFollowing) {
            handleTakibiBirak();
        } else {
            handleTakipEt();
        }
    };

    const handleTakibiBirak = async () => {
        const profilId = parseInt(userId);
        if (!currentUser) return;
        try {
            const response = await fetch('http://localhost:5000/api/takibi-birak', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ takipEden_id: currentUser.id, takipEdilen_id: profilId })
            });
            if (response.ok) {
                setIsFollowing(false);
                setTakipciSayisi(prev => prev - 1);
                alert('Takip bırakıldı.');
            } else {
                const error = await response.json();
                alert(error.message || 'Takibi bırakırken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Takibi bırakma hatası:', err);
            alert('İşlem sırasında bir hata oluştu.');
        }
    };

    const handleTakipEt = async () => {
        const profilId = parseInt(userId);
        if (!currentUser) return;
        try {
            const response = await fetch('http://localhost:5000/api/takip-et', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ takipEden_id: currentUser.id, takipEdilen_id: profilId })
            });
            if (response.ok) {
                setIsFollowing(true);
                setTakipciSayisi(prev => prev + 1);
                alert('Takip edildi.');
            } else {
                const error = await response.json();
                alert(error.message || 'Takip edilirken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Takip etme hatası:', err);
            alert('İşlem sırasında bir hata oluştu.');
        }
    };

    const handleYetkiVer = async (yeniRolId) => {
        const profilId = parseInt(profilKullanici.id);
        if (!currentUser || !yeniRolId) return;
        try {
            const response = await fetch('http://localhost:5000/api/yetkiver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profilId: profilId, rolId: yeniRolId })
            });
            if (response.ok) {
                alert('Kullanıcının yetkisi başarıyla güncellendi!');
                window.location.reload(); 
            } else {
                const error = await response.json();
                alert(error.message || 'Yetki verilirken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Yetki verme hatası:', err);
            alert('İşlem sırasında bir hata oluştu.');
        }
    };

    const handleYetkiAl = async () => {
        const profilId = parseInt(profilKullanici.id);
        if (!currentUser) return;
        try {
            const response = await fetch('http://localhost:5000/api/yetkial', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profilId: profilId})
            });
            if (response.ok) {
                alert('Kullanıcının yetkisi başarıyla güncellendi!');
                window.location.reload(); 
            } else {
                const error = await response.json();
                alert(error.message || 'Yetki alınırken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Yetki alma hatası:', err);
            alert('İşlem sırasında bir hata oluştu.');
        }
    };
    
    // YENİ EKLEME: Modal ile uyarı işlemini gerçekleştiren fonksiyon
    const handleUyariGonder = async () => {
        if (!sebep.trim()) {
            alert('Uyarı sebebi boş olamaz.');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/admin/kullanici-uyar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    user_id: profilKullanici.id, 
                    uyari_yapan_id: currentUser.id, 
                    sebep: sebep 
                }),
            });

            const data = await response.json();
            
            if (response.ok) {
                alert(data.message);
                setShowUyariModal(false); // Modalı kapat
                setSebep(''); // Sebep alanını temizle
            } else {
                alert(`Uyarı işlemi başarısız: ${data.message}`);
            }
        } catch (error) {
            console.error("Uyarı API hatası:", error);
            alert("Sunucuya bağlanırken bir hata oluştu.");
        }
    };

    // YENİ EKLEME: Modal ile banlama işlemini gerçekleştiren fonksiyon
    const handleBanGonder = async () => {
        if (!sebep.trim()) {
            alert('Ban sebebi boş olamaz.');
            return;
        }

        const confirmBan = window.confirm(`'${profilKullanici.username}' kullanıcısını banlamak istediğinize emin misiniz?`);
        if (!confirmBan) return;

        try {
            const response = await fetch('http://localhost:5000/api/admin/kullanici-banla', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: profilKullanici.id,
                    banlayan_id: currentUser.id,
                    sebep: sebep,
                }),
            });

            const data = await response.json();
            
            if (response.ok) {
                alert(data.message);
                setShowBanModal(false); // Modalı kapat
                setSebep(''); // Sebep alanını temizle
            } else {
                alert(`Banlama işlemi başarısız: ${data.message}`);
            }
        } catch (error) {
            console.error("Banlama API hatası:", error);
            alert("Sunucuya bağlanırken bir hata oluştu.");
        }
    };

    const viewerIsAdminOrMod = currentUser?.rol === 'admin' || currentUser?.rol === 'moderator';
    const targetIsAdmin = profilKullanici?.rol === 'admin';
    const targetIsMod = profilKullanici?.rol === 'moderator';
    const canShowActionsMenu = viewerIsAdminOrMod && !targetIsAdmin ;
    const viewerisadmin = currentUser?.rol === 'admin'
    const canBanUser = currentUser?.rol === 'admin' || (currentUser?.rol === 'moderator' && !targetIsAdmin);

    return (
        <div className="profil-container">
            <div className="container">
                <div className="row">
                    <div className="col-lg-4">
                        <div className="profil-karti">
                            <div className="card-body text-center">
                                <div className="profil-avatar">{profilKullanici.name.charAt(0)}</div>
                                <div className="d-flex justify-content-center align-items-center">
                                    <h4 className="card-title mb-0">{profilKullanici.name} {profilKullanici.surname}</h4>
                                    {profilKullanici.rol === 'admin' && <span className="badge bg-danger rol-badge">Admin</span>}
                                    {profilKullanici.rol === 'moderator' && <span className="badge bg-warning text-dark rol-badge">Mod</span>}
                                </div>
                                <p className="text-muted">@{profilKullanici.username}</p>
                                <div className="d-flex justify-content-around takip-stats">
                                    <Link to={`/takip-listesi/${profilKullanici.id}`} state={{ varsayilanSekme: 'takipciler' }} className="text-decoration-none text-dark">
                                        <div className='text-center'><strong>{takipciSayisi}</strong><br/>Takipçi</div>
                                    </Link>
                                    <Link to={`/takip-listesi/${profilKullanici.id}`} state={{ varsayilanSekme: 'takipEdilenler' }} className="text-decoration-none text-dark">
                                        <div className='text-center'><strong>{takipEdilenSayisi}</strong><br/>Takip</div>
                                    </Link>
                                </div>
                                {currentUser && (
                                    <div className="d-grid">
                                        <button className={`btn btn-takip ${isFollowing ? 'takipten-cik' : 'takip-et'}`} onClick={handleToggleTakip}>
                                            <i className={`bi ${isFollowing ? 'bi-person-dash-fill' : 'bi-person-plus-fill'} me-2`}></i>
                                            {isFollowing ? 'Takipten Çık' : 'Takip Et'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {canShowActionsMenu && (
                                <div className="card-footer bg-light p-2 text-center">
                                    <div className="dropdown">
                                        <button className="btn btn-sm btn-outline-secondary w-100" type="button" data-bs-toggle="dropdown">
                                            <i className="bi bi-gear-fill me-2"></i> Moderasyon İşlemleri
                                        </button>
                                        <ul className="dropdown-menu dropdown-menu-end shadow-lg">
                                            <li><button className="dropdown-item" onClick={() => setShowUyariModal(true)}><i className="bi bi-exclamation-triangle-fill me-2"></i>Kullanıcıyı Uyar</button></li>
                                            <li><hr className="dropdown-divider"/></li>
                                            <li> <button className="dropdown-item text-danger" onClick={() => setShowBanModal(true)} disabled={!canBanUser} title={!canBanUser ? "Adminleri banlama yetkiniz yok." : ""}><i className="bi bi-slash-circle-fill me-2"></i>Kullanıcıyı Banla</button></li>
                                            {viewerisadmin && !targetIsAdmin && (
                                            <li className="dropdown-submenu">
                                                <a className="dropdown-item dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                    <i className="bi bi-person-badge-fill me-2"></i>
                                                    Kullanıcıya Yetki Ver
                                                </a>
                                                <ul className="dropdown-menu">
                                                    {roller.map((rol) => (
                                                        <li key={rol.id}>
                                                            <button 
                                                                className="dropdown-item" 
                                                                onClick={() => handleYetkiVer(rol.id)}
                                                            >
                                                                {rol.rol_ad} Yap
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </li>
                                            )}
                                            {viewerisadmin && !targetIsAdmin && targetIsMod && (
                                            <li><button className="dropdown-item" onClick={handleYetkiAl}><i className="bi bi-exclamation-triangle-fill me-2"></i>Yetkiyi al</button></li>
                                             )} </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="col-lg-8">
                        <ul className="nav nav-pills profil-sekmeler nav-fill mb-4">
                            <li className="nav-item">
                                <a className={`nav-link ${aktifSekme === 'paylasimlar' ? 'active' : ''}`} style={{cursor: 'pointer'}} onClick={() => setAktifSekme('paylasimlar')}>
                                    Paylaşımları ({paylasimlar.length})
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className={`nav-link ${aktifSekme === 'sorular' ? 'active' : ''}`} style={{cursor: 'pointer'}} onClick={() => setAktifSekme('sorular')}>
                                    Soruları ({sorular.length})
                                </a>
                            </li>
                        </ul>
                        <div>
                            {aktifSekme === 'paylasimlar' && (
                                <div className="d-flex flex-column gap-3">
                                    {paylasimlar.length > 0 ? (
                                        paylasimlar.map(paylasim => (
                                            <div key={paylasim.id} className="card icerik-karti">
                                                <div className="card-body">
                                                    <h5 className="card-title">{paylasim.title}</h5>
                                                    <p className="card-text text-muted">{paylasim.content.substring(0, 120)}...</p>
                                                    <Link to={`/PaylasimDetay/${paylasim.id}`} className="btn btn-sm btn-git">Paylaşıma Git <i className="bi bi-arrow-right-short"></i></Link>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-muted mt-4">
                                            {`${profilKullanici.name} henüz herkese açık bir paylaşım yapmamış.`}
                                        </p>
                                    )}
                                </div>
                            )}
                            {aktifSekme === 'sorular' && (
                                <div className="d-flex flex-column gap-3">
                                    {sorular.length > 0 ? (
                                        sorular.map(soru => (
                                            <div key={soru.id} className="card icerik-karti">
                                                <div className="card-body">
                                                    <h5 className="card-title">{soru.title}</h5>
                                                    <p className="card-text text-muted">{soru.content.substring(0, 120)}...</p>
                                                    <Link to={`/sorular/${soru.id}`} className="btn btn-sm btn-git">Soruya Git <i className="bi bi-arrow-right-short"></i></Link>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-muted mt-4">
                                            {`${profilKullanici.name} henüz herkese açık bir soru sormamış.`}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Uyarı Modalı */}
            <div className={`modal fade ${showUyariModal ? 'show d-block' : ''}`} tabIndex="-1" role="dialog" style={{ display: showUyariModal ? 'block' : 'none' }}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Kullanıcıyı Uyar</h5>
                            <button type="button" className="btn-close" onClick={() => setShowUyariModal(false)}></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="uyariSebep">Uyarı sebebi:</label>
                                <textarea 
                                    className="form-control" 
                                    id="uyariSebep" 
                                    rows="3" 
                                    value={sebep} 
                                    onChange={(e) => setSebep(e.target.value)} 
                                    placeholder="Uyarı sebebini açıklayınız..."
                                ></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowUyariModal(false)}>İptal</button>
                            <button type="button" className="btn btn-danger" onClick={handleUyariGonder}>Uyar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ban Modalı */}
            <div className={`modal fade ${showBanModal ? 'show d-block' : ''}`} tabIndex="-1" role="dialog" style={{ display: showBanModal ? 'block' : 'none' }}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Kullanıcıyı Banla</h5>
                            <button type="button" className="btn-close" onClick={() => setShowBanModal(false)}></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="banSebep">Ban sebebi:</label>
                                <textarea 
                                    className="form-control" 
                                    id="banSebep" 
                                    rows="3" 
                                    value={sebep} 
                                    onChange={(e) => setSebep(e.target.value)} 
                                    placeholder="Ban sebebini açıklayınız..."
                                ></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowBanModal(false)}>İptal</button>
                            <button type="button" className="btn btn-danger" onClick={handleBanGonder}>Banla</button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Modal arka planı */}
            {(showUyariModal || showBanModal) && <div className="modal-backdrop fade show"></div>}

        </div>
    );
}

export default KullaniciProfil;