import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import YorumKarti from './YorumKarti'; 
import './css/SoruDetay.css';

function SoruDetay() {
    const { soruId } = useParams();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [soru, setSoru] = useState(null);
    const [yorumTree, setYorumTree] = useState([]);
    const [kaldirilanYorumlar, setKaldirilanYorumlar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [yorumGonderiliyor, setYorumGonderiliyor] = useState(false);
    
    const [yeniYorum, setYeniYorum] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [cevapIcerik, setCevapIcerik] = useState("");
    
    // FOTOĞRAF KARIŞMA SİSTEMİ İÇİN YENİ STATE'LER
    const [fotograflar, setFotograflar] = useState([]);
    const [aktifFotoIndex, setAktifFotoIndex] = useState(0);

    const fetchSoruDetay = useCallback(async () => {
        setLoading(true);
        setError('');

        const numericSoruId = parseInt(soruId, 10);
        if (isNaN(numericSoruId)) { 
            setError('Geçersiz soru adresi.'); 
            setLoading(false); 
            return; 
        }

        try {
            const response = await fetch(`/api/sorudetay/${numericSoruId}`);
            
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Sunucudan JSON bekleniyordu ancak HTML geldi. API endpoint'i kontrol edin.");
            }
            
            if (!response.ok) {
                if (response.status === 404) {
                    setError('Soru bulunamadı veya kaldırılmış.');
                } else {
                    throw new Error('Veri yüklenemedi');
                }
                setLoading(false);
                return;
            }

            const data = await response.json();
            
            setSoru({ ...data.soru, hastaliklar: data.soru.hastaliklar, ilaclar: data.soru.ilaclar });
            setFotograflar(data.soru.fotograflar || []);

            const uniqueYorumlar = data.yorumlar || [];
            const seenIds = new Set();
            
            const filterDuplicates = (yorumlar) => {
                return yorumlar.filter(yorum => {
                    if (!seenIds.has(yorum.id)) {
                        seenIds.add(yorum.id);
                        if (yorum.children && yorum.children.length > 0) {
                            yorum.children = filterDuplicates(yorum.children);
                        }
                        return true;
                    }
                    console.warn(`Duplicate yorum ID tespit edildi: ${yorum.id}`);
                    return false;
                });
            };
            
            setYorumTree(filterDuplicates(uniqueYorumlar));
            setKaldirilanYorumlar(data.kaldirilanYorumlar || []);
            
        } catch (err) {
            console.error('Soru detayı yüklenirken hata:', err);
            setError(err.message || 'Soru yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    }, [soruId]);

    useEffect(() => {
        fetchSoruDetay();
    }, [fetchSoruDetay]);

    const handleSikayetEt = async () => {
        if (!soru || !currentUser) return;
        
        try {
            const response = await fetch('/api/sorusikayet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    soru_id: soru.id,
                    sikayet_eden_id: currentUser.id,
                    sikayet_nedeni: 'Uygunsuz içerik'
                })
            });

            if (response.ok) {
                alert(`'${soru.title}' başlıklı soru şikayet edildi! İncelemeye alındı.`);
            }
        } catch (error) {
            console.error('Şikayet edilirken hata:', error);
            alert('Şikayet işlemi sırasında bir hata oluştu.');
        }
    };

    const handleSoruyuKaldir = async () => {
        if (!soru || !currentUser) return;
        
        const confirmDelete = window.confirm(`'${soru.title}' başlıklı soruyu kalıcı olarak kaldırmak istediğinize emin misiniz?`);
        if (!confirmDelete) return;

        try {
            const response = await fetch(`/api/sorusil/${soru.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kaldiran_id: currentUser.id,
                    kaldiran_rol: currentUser.rol
                })
            });

            if (response.ok) {
                alert('Soru başarıyla kaldırıldı!');
                navigate('/sorular');
            } else if (response.status === 403) {
                alert('Bu soruyu kaldırma yetkiniz yok.');
            }
        } catch (error) {
            console.error('Soru kaldırılırken hata:', error);
            alert('Soru kaldırılırken bir hata oluştu.');
        }
    };

    const handleSubmit = async (e, content, parentId, clearFormFunc) => {
        e.preventDefault();
        if (!currentUser || !content.trim() || yorumGonderiliyor) return;
        
        setYorumGonderiliyor(true);
        
        try {
            const response = await fetch('/api/yorumekle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parent_id: parentId,
                    user_id: currentUser.id,
                    content: content.trim()
                })
            });

            if (!response.ok) {
                throw new Error('Yorum gönderilemedi');
            }

            const yeniYorumData = await response.json();
            
            if (parentId.startsWith('q')) {
                setYorumTree(prev => [...prev, { ...yeniYorumData, children: [] }]);
            } else {
                const updateTree = (yorumlar) => {
                    return yorumlar.map(yorum => {
                        if (yorum.id.toString() === parentId) {
                            return {
                                ...yorum,
                                children: [...(yorum.children || []), { ...yeniYorumData, children: [] }]
                            };
                        } else if (yorum.children && yorum.children.length > 0) {
                            return {
                                ...yorum,
                                children: updateTree(yorum.children)
                            };
                        }
                        return yorum;
                    });
                };
                
                setYorumTree(prev => updateTree(prev));
            }
            
            clearFormFunc();
            setReplyingTo(null);
            
        } catch (error) {
            console.error('Yorum gönderilirken hata:', error);
            alert('Yorum gönderilirken bir hata oluştu.');
        } finally {
            setYorumGonderiliyor(false);
        }
    };

    const handleYorumSil = async (yorumId) => {
        if (!currentUser) return;
        
        try {
            const response = await fetch(`/api/yorumsil/${yorumId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    user_role: currentUser.rol || 'kullanici',
                })
            });

            if (response.ok) {
                setKaldirilanYorumlar(prev => [...prev, yorumId]);
                alert('Yorum başarıyla kaldırıldı!');
            } else if (response.status === 403) {
                alert('Bu yorumu kaldırma yetkiniz yok.');
            }
        } catch (error) {
            console.error('Yorum silinirken hata:', error);
            alert('Yorum silinirken bir hata oluştu.');
        }
    };

    const handleYorumSikayet = async (yorumId) => {
        if (!currentUser) return;
        
        try {
            const response = await fetch('/api/yorumsikayet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    yorum_id: yorumId,
                })
            });

            if (response.ok) {
                alert('Yorum şikayetiniz alındı ve incelenecektir.');
            }
        } catch (error) {
            console.error('Yorum şikayet edilirken hata:', error);
            alert('Şikayet işlemi sırasında bir hata oluştu.');
        }
    };
    
    const getProfilPath = (targetUserId) => { 
        if (currentUser && currentUser.id === targetUserId) return '/profilim'; 
        return `/profil/${targetUserId}`; 
    };
    
    const formatDate = (dateString) => { 
        return new Date(dateString).toLocaleString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            day: 'numeric', 
            month: 'short' 
        }); 
    };
    
    const handleCevaplaClick = (yorumId) => { 
        setReplyingTo(prev => (prev === yorumId ? null : yorumId)); 
        setCevapIcerik(''); 
    };

    // FOTOĞRAF KAYDIRMA FONKSİYONLARI
    const handleNextPhoto = () => {
        setAktifFotoIndex((prevIndex) => (prevIndex + 1) % fotograflar.length);
    };

    const handlePrevPhoto = () => {
        setAktifFotoIndex((prevIndex) => (prevIndex - 1 + fotograflar.length) % fotograflar.length);
    };

    if (loading) {
        return (
            <div className="soru-detay-container">
                <div className="container">
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <h3 className="loading-text">Yükleniyor...</h3>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !soru) { 
        return ( 
            <div className="soru-detay-container">
                <div className="container">
                    <div className="error-container">
                        <div className="error-alert">
                            <i className="bi bi-exclamation-circle-fill me-2"></i>
                            {error || 'Soru bulunamadı.'}
                        </div>
                        <Link to="/sorular" className="error-back-btn">
                            <i className="bi bi-arrow-left me-2"></i>
                            Tüm Sorulara Dön
                        </Link>
                    </div>
                </div>
            </div>
        ); 
    }
    
    const isMyQuestion = currentUser?.id === soru.user_id;
    const questionOwnerIsAdmin = soru.user_role === 'admin';
    const canShowReportButton = currentUser?.rol === 'kullanici' && !isMyQuestion;
    const canShowRemoveButton = isMyQuestion || (currentUser?.rol === 'admin') || 
                                (currentUser?.rol === 'moderator' && !questionOwnerIsAdmin);
    const canShowMenu = canShowReportButton || canShowRemoveButton;

    const activePhoto = fotograflar[aktifFotoIndex];

    return (
        <div className="soru-detay-container">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-lg-9">
                        
                        <Link to="/sorular" className="back-link">
                            <i className="bi bi-arrow-left"></i>
                            Tüm Sorulara Dön
                        </Link>
                        
                        <div className="question-header">
                            <div className="title-menu-container">
                                <h1 className="question-title">{soru.title}</h1>
                                
                                {canShowMenu && (
                                    <div className="dropdown options-dropdown">
                                        <button 
                                            className="btn" 
                                            type="button" 
                                            data-bs-toggle="dropdown" 
                                            aria-expanded="false"
                                        >
                                            <i className="bi bi-three-dots-vertical"></i>
                                        </button>
                                        <ul className="dropdown-menu dropdown-menu-end">
                                            {canShowReportButton && (
                                                <li>
                                                    <button className="dropdown-item" onClick={handleSikayetEt}>
                                                        <i className="bi bi-flag-fill"></i>
                                                        Şikayet Et
                                                    </button>
                                                </li>
                                            )}
                                            {canShowRemoveButton && (
                                                <li>
                                                    <button className="dropdown-item text-danger" onClick={handleSoruyuKaldir}>
                                                        <i className="bi bi-trash-fill"></i>
                                                        Soruyu Kaldır
                                                    </button>
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            
                            <div className="question-meta">
                                {soru.is_anonymous ? (
                                    <span className="anonymous-badge">
                                        <i className="bi bi-incognito me-1"></i>
                                        Anonim
                                    </span>
                                ) : (
                                    <Link to={getProfilPath(soru.user_id)} className="author-link">
                                        <i className="bi bi-person-circle me-1"></i>
                                        {soru.user_name} {soru.user_surname}
                                    </Link>
                                )}
                                <span className="meta-separator">•</span>
                                <span>
                                    <i className="bi bi-clock me-1"></i>
                                    {formatDate(soru.date)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="card question-content-card">
                            <div className="card-body question-content-body">
                                <p className="question-text">{soru.content}</p>
                                
                                {fotograflar.length > 0 && (
                                    <div className="fotograf-galeri-container">
                                        <img src={`data:image/jpeg;base64,${activePhoto.image}`} alt="Soru Fotoğrafı" className="galeri-fotografi" />
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

                                {(soru.hastaliklar?.length > 0 || soru.ilaclar?.length > 0) && (
                                    <div className="tags-section">
                                        {soru.hastaliklar?.map(hastalik => (
                                            <span key={`h-${hastalik.id}`} className="badge tag-badge illness-badge">
                                                <i className="bi bi-heart-pulse"></i>
                                                {hastalik.illness_name}
                                            </span>
                                        ))}
                                        {soru.ilaclar?.map(ilac => (
                                            <span key={`i-${ilac.id}`} className="badge tag-badge medicine-badge">
                                                <i className="bi bi-capsule"></i>
                                                {ilac.medicine_name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {currentUser ? (
                        // Kullanıcı giriş yapmışsa yorum formunu göster
                        <div className="card comment-form-card">
                            <div className="card-body">
                                <h5 className="comment-form-title">
                                    <i className="bi bi-chat-dots-fill"></i>
                                    Yoruma Katıl
                                </h5>
                                <form onSubmit={(e) => handleSubmit(e, yeniYorum, `q${soru.id}`, () => setYeniYorum(''))}>
                                    <textarea 
                                        className="form-control comment-textarea" 
                                        rows="3" 
                                        value={yeniYorum} 
                                        onChange={(e) => setYeniYorum(e.target.value)} 
                                        placeholder="Düşüncelerini paylaş, topluluğa katkıda bulun..."
                                        disabled={yorumGonderiliyor}
                                    />
                                    <button 
                                        type="submit" 
                                        className="btn comment-submit-btn" 
                                        disabled={!yeniYorum.trim() || yorumGonderiliyor}
                                    >
                                        <i className="bi bi-send-fill me-2"></i>
                                        {yorumGonderiliyor ? 'Gönderiliyor...' : 'Gönder'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        // Kullanıcı giriş yapmamışsa yönlendirme mesajını göster
                        <div className="card comment-form-card text-center">
                            <div className="card-body">
                                <i className="bi bi-person-fill-lock text-muted mb-3" style={{ fontSize: '2rem' }}></i>
                                <h5 className="comment-form-title text-muted">Yorum Yapmak İçin Giriş Yapın</h5>
                                <p className="text-muted">Bu paylaşıma yorum yapmak ve tartışmalara katılmak için lütfen giriş yapın.</p>
                                <Link to="/login" className="btn btn-primary mt-2">
                                    <i className="bi bi-box-arrow-in-right me-2"></i> Giriş Yap
                                </Link>
                            </div>
                        </div>
                    )}
                        
                        <h3 className="comments-section-title">Yorumlar</h3>
                        
                        <div className="comments-container">
                            {yorumTree.map((yorum, index) => (
                                <YorumKarti 
                                    key={`root-yorum-${yorum.id}-${index}`}
                                    yorum={yorum} 
                                    childYorumlar={yorum.children || []} 
                                    onCevapla={handleCevaplaClick} 
                                    onFormSubmit={handleSubmit}
                                    onYorumSil={handleYorumSil}
                                    onYorumSikayet={handleYorumSikayet}
                                    getProfilPath={getProfilPath} 
                                    formatDate={formatDate} 
                                    currentUser={currentUser} 
                                    replyingTo={replyingTo} 
                                    cevapIcerik={cevapIcerik} 
                                    setCevapIcerik={setCevapIcerik}
                                    kaldirilanYorumlar={kaldirilanYorumlar}
                                    yorumGonderiliyor={yorumGonderiliyor}
                                />
                            ))}
                            
                            {!loading && yorumTree.length === 0 && (
                                <div className="no-comments-message">
                                    <i className="bi bi-chat-left-dots"></i>
                                    <p>Bu soruya henüz hiç yorum yapılmamış.</p>
                                    <p><strong>İlk yorumu sen yap!</strong></p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SoruDetay;