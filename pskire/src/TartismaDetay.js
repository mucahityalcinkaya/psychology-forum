import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import YorumKarti from './YorumKarti';
import Swal from 'sweetalert2';

// Yetkilendirme mantığını içeren yardımcı fonksiyon
const getAuthActions = (contentOwner, currentUser) => {
    // Gerekli veriler yoksa hiçbir yetki verme
    if (!currentUser || !contentOwner) {
        return { canReport: false, canRemove: false };
    }

    const isOwner = currentUser.id === contentOwner.user_id;
    const isOwnerAdmin = contentOwner.user_rol === 'admin';
    const isCurrentUserAdminOrMod = currentUser.rol === 'admin' || currentUser.rol === 'moderator';
    const isCurrentUserRegular = !isCurrentUserAdminOrMod;

    // KALDIRMA YETKİSİ KONTROLÜ
    let canRemove = false;
    // Kural: Kullanıcı kendi içeriğini silebilir.
    if (isOwner) {
        canRemove = true;
    } 
    // Kural: Admin veya Moderatör, sahibi admin olmayan bir içeriği silebilir.
    else if (isCurrentUserAdminOrMod && !isOwnerAdmin) {
        canRemove = true;
    }

    // ŞİKAYET ETME YETKİSİ KONTROLÜ
    let canReport = false;
    // Kural: Sadece normal kullanıcılar, başkasına ait ve sahibi admin olmayan bir içeriği şikayet edebilir.
    if (isCurrentUserRegular && !isOwner && !isOwnerAdmin) {
        canReport = true;
    }

    return { canReport, canRemove };
};


function TartismaDetay() {
    const { tartismaId } = useParams();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [tartisma, setTartisma] = useState(null);
    const [yorumTree, setYorumTree] = useState([]);
    const [kaldirilanYorumlar, setKaldirilanYorumlar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [yeniYorum, setYeniYorum] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    const [cevapIcerik, setCevapIcerik] = useState("");
    const [yorumGonderiliyor, setYorumGonderiliyor] = useState(false);

    const buildTree = useCallback((list, parentId) => {
        return list
            .filter(item => item.parent_id === parentId)
            .map(item => ({
                ...item,
                children: buildTree(list, item.id.toString())
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5000/api/tartismalar/${tartismaId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Veriler yüklenirken bir hata oluştu.');
            }
            
            const { tartisma, yorumlar, kaldirilanYorumIdleri } = data;
            setTartisma(tartisma);
            setYorumTree(buildTree(yorumlar, `t${tartismaId}`));
            setKaldirilanYorumlar(kaldirilanYorumIdleri || []);

        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [tartismaId, buildTree]);
    
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleSubmit = async (e, content, parentId, clearFormFunc) => {
        e.preventDefault();
        if (!currentUser || !content.trim()) return;
        
        setYorumGonderiliyor(true);
        try {
            const response = await fetch('http://localhost:5000/api/tartismayorum', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: content,
                    parent_id: parentId,
                    user_id: currentUser.id 
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Yorum gönderilirken bir hata oluştu.");
            }

            clearFormFunc();
            setReplyingTo(null);
            await fetchData();
        } catch (err) {
            Swal.fire('Hata!', err.message, 'error');
            console.error(err);
        } finally {
            setYorumGonderiliyor(false);
        }
    };

    const handleYorumKaldir = async (yorumId) => {
        if (!currentUser) return;
        try {
            const response = await fetch(`http://localhost:5000/api/tartismayorumkaldir/${yorumId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kaldiran_id: currentUser.id,kaldiran_rol:currentUser.rol })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            Swal.fire('Başarılı!', data.message, 'success');
            await fetchData();
        } catch (err) {
            Swal.fire('Hata!', err.message, 'error');
            console.error(err);
        }
    };
    
    const handleYorumSikayet = async (yorumId) => {
        if(!currentUser) return;
        try {
            const response = await fetch('http://localhost:5000/api/tartismayorumsikayet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yorum_id: yorumId })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            Swal.fire('Gönderildi', data.message, 'success');
        } catch (err) {
            Swal.fire('Hata!', err.message, 'error');
        }
    };
    
    const formatDate = (dateString) => new Date(dateString).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    const getProfilPath = (userId) => currentUser?.id === userId ? '/profilim' : `/profil/${userId}`;
    const handleCevaplaClick = (yorumId) => {
        setReplyingTo(prev => (prev === yorumId ? null : yorumId));
        setCevapIcerik('');
    };
    
    const handleTartismaKaldir = async () => {
        if (!tartisma || !currentUser) return;
        const result = await Swal.fire({
            title: 'Emin misiniz?',
            text: "Bu tartışmayı ve tüm yorumlarını kalıcı olarak kaldırmak üzeresiniz!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Evet, kaldır!',
            cancelButtonText: 'İptal'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`http://localhost:5000/api/tartismakaldir/${tartisma.id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kaldiran_id: currentUser.id,kaldiran_rol:currentUser.rol })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                await Swal.fire("Başarılı!", "Tartışma başarıyla kaldırıldı.", 'success');
                navigate('/tartismalar');
            } catch (err) {
                Swal.fire('Hata!', err.message, 'error');
            }
        }
    };
    
    const handleTartismaSikayet = async () => {
        if (!tartisma || !currentUser) return;
        try {
            const response = await fetch('http://localhost:5000/api/tartismasikayet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tartisma_id: tartisma.id })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            Swal.fire('Gönderildi', data.message, 'success');
        } catch (err) {
            Swal.fire('Hata!', err.message, 'error');
        }
    };

    if (loading) return <div className="text-center my-5"><h3>Yükleniyor...</h3></div>;
    if (error) return <div className="alert alert-danger my-5">{error}</div>;

    const tartismaAuth = tartisma ? getAuthActions(tartisma, currentUser) : { canReport: false, canRemove: false };

    return (
        <div className='container my-5'>
            <div className='row justify-content-center'>
                <div className='col-lg-9'>
                    <Link to="/tartismalar" className="text-muted text-decoration-none mb-3 d-inline-block">
                        <i className="bi bi-arrow-left"></i> Tüm Tartışmalara Dön
                    </Link>
                    {tartisma && (
                        <div className="card mb-4 shadow-sm">
                            <div className="card-body p-4">
                                <div className="d-flex justify-content-between align-items-start">
                                    <h1 className="h3 me-3">{tartisma.title}</h1>
                                    {(tartismaAuth.canRemove || tartismaAuth.canReport) && (
                                        <div className="dropdown">
                                            <button className="btn btn-sm btn-light py-0 px-2" type="button" data-bs-toggle="dropdown">
                                                <i className="bi bi-three-dots-vertical"></i>
                                            </button>
                                            <ul className="dropdown-menu dropdown-menu-end">
                                                {tartismaAuth.canReport && (
                                                    <li><button className="dropdown-item" onClick={handleTartismaSikayet}>Şikayet Et</button></li>
                                                )}
                                                {tartismaAuth.canRemove && (
                                                    <li><button className="dropdown-item text-danger" onClick={handleTartismaKaldir}>Tartışmayı Kaldır</button></li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <small className="text-muted">
                                    Başlatan: 
                                    <Link to={getProfilPath(tartisma.user_id)} className="fw-bold text-decoration-none text-dark ms-1">
                                        {tartisma.user_name} {tartisma.user_surname}
                                    </Link>
                                </small>
                                {tartisma.content && <p className="mt-3 lead fs-6">{tartisma.content}</p>}
                            </div>
                        </div>
                    )}
                    {currentUser && (
                        <div className="card mb-5">
                            <div className="card-body">
                                <h5 className="card-title">Yoruma Katıl</h5>
                                <form onSubmit={(e) => handleSubmit(e, yeniYorum, `t${tartismaId}`, () => setYeniYorum(''))}>
                                    <textarea className="form-control" rows="3" value={yeniYorum} onChange={(e) => setYeniYorum(e.target.value)} placeholder="Fikrini belirt..."></textarea>
                                    <button type="submit" className="btn btn-primary mt-2" disabled={!yeniYorum.trim() || yorumGonderiliyor}>
                                        {yorumGonderiliyor ? 'Gönderiliyor...' : 'Gönder'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                    <h3 className="mb-4">Yorumlar</h3>
                    <div className="d-flex flex-column gap-3">
                        {yorumTree.map(yorum => (
                            <YorumKarti 
                                key={yorum.id}
                                yorum={yorum}
                                childYorumlar={yorum.children || []}
                                onCevapla={handleCevaplaClick}
                                onFormSubmit={handleSubmit}
                                onYorumKaldir={handleYorumKaldir} // İsim düzeltildi
                                onYorumSikayet={handleYorumSikayet}
                                getProfilPath={getProfilPath}
                                formatDate={formatDate}
                                currentUser={currentUser}
                                replyingTo={replyingTo}
                                cevapIcerik={cevapIcerik}
                                setCevapIcerik={setCevapIcerik}
                                kaldirilanYorumlar={kaldirilanYorumlar}
                                yorumGonderiliyor={yorumGonderiliyor}
                                getAuthActions={getAuthActions} // Yetki fonksiyonu prop olarak geçildi
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TartismaDetay;