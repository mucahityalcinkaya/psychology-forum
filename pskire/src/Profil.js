import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './css/Profil.css';

function Profil() {
    const [aktifSekme, setAktifSekme] = useState('paylasimlar');
    const [takipciSayisi, setTakipciSayisi] = useState(0);
    const [takipEdilenSayisi, setTakipEdilenSayisi] = useState(0);
    const [paylasimlarim, setPaylasimlarim] = useState([]);
    const [sorularim, setSorularim] = useState([]);

    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    // Takip sayılarını çek
    useEffect(() => {
        if (currentUser) {
            // Takip sayılarını al
            fetch(`/api/kullanicilar/${currentUser.id}/takip-sayilari`)
                .then(response => response.json())
                .then(data => {
                    setTakipciSayisi(data.takipciSayisi);
                    setTakipEdilenSayisi(data.takipEdilenSayisi);
                })
                .catch(error => console.error("Takip sayıları çekerken hata:", error));

            // Kullanıcının paylaşımlarını al
            fetch(`/api/kullanicipves/${currentUser.id}`)
                .then(response => response.json())
                .then(data => {
                setPaylasimlarim(data.paylasimlar || []); // API'den veri gelmezse diye [] kontrolü eklemek iyidir.
                setSorularim(data.sorular || []);       // API'den veri gelmezse diye [] kontrolü eklemek iyidir.
                })
                .catch(error => console.error("Paylaşımları çekerken hata:", error));

        }
    }, [currentUser]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const takipciCikar = async (kullaniciId) => {
        if (!currentUser) return;
        
        try {
            const response = await fetch('/api/takipci-cikar', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    takipEden_id: kullaniciId,
                    takipEdilen_id: currentUser.id
                })
            });
            
            if (response.ok) {
                // Takipçi sayısını güncelle
                setTakipciSayisi(prev => prev - 1);
                alert('Takipçi çıkarıldı.');
            } else {
                const error = await response.json();
                alert(error.message || 'Takipçiyi çıkarırken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Takipçi çıkarma hatası:', err);
            alert('İşlem sırasında bir hata oluştu.');
        }
    };

    if (!currentUser) {
        return (
            <div className="container my-5 text-center">
                <h2>Lütfen önce giriş yapınız.</h2>
                <Link to="/login" className="btn btn-primary">Giriş Yap</Link>
            </div>
        );
    }

    return (
        <div className="profil-container">
            <div className="container">
                <div className="row">
                    {/* SOL TARAF: PROFİL BİLGİLERİ */}
                    <div className="col-lg-4">
                        <div className="profil-karti">
                            <div className="card-body text-center">
                                <div className="profil-avatar">{currentUser.name.charAt(0)}</div>
                                <h4 className="card-title">{currentUser.name} {currentUser.surname}</h4>
                                <p className="text-muted mb-1">@{currentUser.username}</p>
                                <p className="text-muted small">{currentUser.email}</p>
                                
                                <div className="d-flex justify-content-around takip-stats">
                                    <Link to={`/takip-listesi/${currentUser.id}`} state={{ varsayilanSekme: 'takipciler' }} className="text-decoration-none text-dark">
                                        <div className='text-center'>
                                            <strong>{takipciSayisi}</strong><br/>Takipçi
                                        </div>
                                    </Link>
                                    <Link to={`/takip-listesi/${currentUser.id}`} state={{ varsayilanSekme: 'takipEdilenler' }} className="text-decoration-none text-dark">
                                        <div className='text-center'>
                                            <strong>{takipEdilenSayisi}</strong><br/>Takip
                                        </div>
                                    </Link>
                                </div>
                            </div>
                            <div className="list-group list-group-flush">
                                <Link to="/profil/duzenle" className="list-group-item list-group-item-action">
                                    <i className="bi bi-person-fill-gear me-2"></i> Profili Güncelle
                                </Link>
                                <Link to="/profil/sifre" className="list-group-item list-group-item-action">
                                    <i className="bi bi-key-fill me-2"></i> Şifreyi Güncelle
                                </Link>
                                <a href="#" className="list-group-item list-group-item-action list-group-item-danger" onClick={e => { e.preventDefault(); handleLogout(); }}>
                                    <i className="bi bi-box-arrow-right me-2"></i> Çıkış Yap
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* SAĞ TARAF: SEKMELİ İÇERİK */}
                    <div className="col-lg-8">
                        <ul className="nav nav-pills profil-sekmeler nav-fill mb-4">
                            <li className="nav-item">
                                <a className={`nav-link ${aktifSekme === 'paylasimlar' ? 'active' : ''}`} onClick={() => setAktifSekme('paylasimlar')}>
                                    <i className="bi bi-file-earmark-text-fill me-2"></i> Paylaşımlarım ({paylasimlarim.length})
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className={`nav-link ${aktifSekme === 'sorular' ? 'active' : ''}`} onClick={() => setAktifSekme('sorular')}>
                                    <i className="bi bi-patch-question-fill me-2"></i> Sorularım ({sorularim.length})
                                </a>
                            </li>
                        </ul>

                        <div>
                            {aktifSekme === 'paylasimlar' && (
                                <div className="d-flex flex-column gap-3">
                                    {paylasimlarim.length > 0 ? paylasimlarim.map(paylasim => (
                                        <div key={paylasim.id} className="card icerik-karti">
                                            <div className="card-body">
                                                <h5 className="card-title">{paylasim.title}</h5>
                                                <p className="card-text text-muted">
                                                    {paylasim.content ? paylasim.content.substring(0, 120) : ''}...
                                                </p>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <small className="text-muted">
                                                        {new Date(paylasim.date).toLocaleDateString('tr-TR')}
                                                    </small>
                                                    <Link to={`/PaylasimDetay/${paylasim.id}`} className="btn btn-sm btn-git">
                                                        Paylaşıma Git <i className="bi bi-arrow-right-short"></i>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center p-5 bg-light rounded-3">
                                            <p className="mb-0">Henüz hiç paylaşım yapmadınız.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {aktifSekme === 'sorular' && (
                                <div className="d-flex flex-column gap-3">
                                    {sorularim.length > 0 ? sorularim.map(soru => (
                                        <div key={soru.id} className="card icerik-karti">
                                            <div className="card-body">
                                                <h5 className="card-title">{soru.title}</h5>
                                                <p className="card-text text-muted">
                                                    {soru.content ? soru.content.substring(0, 120) : ''}...
                                                </p>
                                                <Link to={`/sorular/${soru.id}`} className="btn btn-sm btn-git">
                                                    Soruya Git <i className="bi bi-arrow-right-short"></i>
                                                </Link>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center p-5 bg-light rounded-3">
                                            <p className="mb-0">Henüz hiç soru sormadınız.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profil;