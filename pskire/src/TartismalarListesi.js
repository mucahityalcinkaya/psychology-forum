import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './css/TartismalarListesi.css';

// Yetki kontrol fonksiyonu: Bir içeriği kimin kaldırabileceğini belirler.
const canUserRemove = (contentOwner, currentUser) => {
    // Mevcut kullanıcı veya içerik sahibi bilgisi yoksa, yetki yoktur.
    if (!currentUser || !contentOwner) return false;

    // Kural 1: Kullanıcı admin ise ve kendi içeriğini siliyorsa silebilir.
    if (currentUser.id === contentOwner.user_id && currentUser.rol === 'admin') {
        return true;
    }
    
    // Kural 2: Kullanıcı kendi içeriğini her zaman kaldırabilir.
    if (currentUser.id === contentOwner.user_id) {
        return true;
    }
    
    // Kural 3: Admin veya moderatörler, içeriği oluşturan kişi admin değilse kaldırabilir.
    if ((currentUser.rol === 'admin' || currentUser.rol === 'moderator') && contentOwner.user_rol !== 'admin') {
        return true;
    }

    // Yukarıdaki kurallara uymuyorsa yetkisi yoktur.
    return false;
};

function TartismalarListesi() {
    const { currentUser } = useAuth();
    
    const [tartismalar, setTartismalar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Tartışmaları API'den çeken ana fonksiyon
    const fetchTartismalar = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/api/tartismalar');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Tartışmalar yüklenirken bir hata oluştu.');
            }

            setTartismalar(data);

        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Component ilk yüklendiğinde verileri çek
    useEffect(() => {
        fetchTartismalar();
    }, []);

    // Tartışmayı kaldırma işlemini yapan fonksiyon
    const handleTartismaKaldir = async (tartismaId) => {
        if (!currentUser || !window.confirm("Bu tartışmayı kaldırmak istediğinize emin misiniz?")) return;

        try {
            const response = await fetch(`http://localhost:5000/api/tartismakaldir/${tartismaId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kaldiran_id: currentUser.id, kaldiran_rol:currentUser.rol})
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            alert("Tartışma başarıyla kaldırıldı.");
            fetchTartismalar(); // Kaldırma işleminden sonra listeyi yenile
        } catch (err) {
            alert(`Hata: ${err.message}`);
        }
    };

    // Profil linkini oluşturan yardımcı fonksiyon
    const getProfilPath = (targetUserId) => {
        if (currentUser && currentUser.id === targetUserId) {
            return '/profilim';
        }
        return `/profil/${targetUserId}`;
    };

    if (loading) return <div className="text-center my-5"><h3>Yükleniyor...</h3></div>;
    if (error) return <div className="alert alert-danger my-5">{error}</div>;

    return (
        <div className="container my-5">
            <div className="pb-3 mb-4 border-bottom d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                    <i className="bi bi-journals fs-2 me-3 text-primary"></i>
                    <div>
                        <h1 className="h2 mb-0">Tartışma Forumu</h1>
                        <p className="mb-0 text-muted">Toplulukla etkileşime geçin ve fikirlerinizi paylaşın.</p>
                    </div>
                </div>
                {/* Sadece giriş yapmış kullanıcılar için "Yeni Tartışma Başlat" butonu */}
                {currentUser && (
                    <Link to="/tartisma-olustur" className="btn btn-primary">
                        <i className="bi bi-plus-lg me-2"></i>Yeni Tartışma Başlat
                    </Link>
                )}
            </div>

            <div className="row g-4 align-items-start">
                {tartismalar.length > 0 ? (
                    tartismalar.map(tartisma => (
                        <div key={tartisma.id} className="col-lg-6">
                            <div className="card h-100 shadow-sm tartisma-card">
                                <div className="card-body d-flex flex-column">
                                    <h5 className="card-title">
                                        <Link to={`/tartismalar/${tartisma.id}`} className="text-decoration-none text-dark stretched-link">
                                            {tartisma.title}
                                        </Link>
                                    </h5>
                                    
                                    <p className="card-text text-muted flex-grow-1">
                                        {tartisma.content ? `${tartisma.content.substring(0, 100)}...` : 'Bu tartışmaya katılmak için tıklayın.'}
                                    </p>
                                    
                                    <div className="preview-yorumlar mb-3">
                                        {tartisma.onekiYorumlar && tartisma.onekiYorumlar.map(yorum => (
                                            <div key={yorum.id} className="d-flex align-items-start mb-2">
                                                <i className="bi bi-chat-right-text-fill text-secondary me-2 mt-1"></i>
                                                <small className="text-muted">
                                                    <strong className="text-dark">{yorum.user_name}:</strong>
                                                    {` "${yorum.content.substring(0, 60)}..."`}
                                                </small>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                                        <small className="text-muted d-flex align-items-center">
                                            <i className="bi bi-person-fill me-2"></i>
                                            <Link to={getProfilPath(tartisma.user_id)} className="fw-bold text-decoration-none text-muted" style={{ zIndex: 2, position: 'relative' }}>
                                                {tartisma.user_name}
                                            </Link>
                                        </small>
                                        <div className="d-flex align-items-center">
                                            {/* Yetkiye göre "Kaldır" butonu */}
                                            {canUserRemove(tartisma, currentUser) && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleTartismaKaldir(tartisma.id); }}
                                                    className="btn btn-sm btn-outline-danger me-2" 
                                                    style={{ zIndex: 2, position: 'relative' }}
                                                    title="Tartışmayı Kaldır"
                                                >
                                                    <i className="bi bi-trash-fill"></i>
                                                </button>
                                            )}
                                            <small className="text-primary fw-bold d-flex align-items-center">
                                                <i className="bi bi-chat-dots-fill me-2"></i>
                                                {tartisma.etkilesim_sayisi} Etkileşim
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-12"><p className="text-center">Henüz hiç tartışma başlatılmamış.</p></div>
                )}
            </div>
        </div>
    );
}

export default TartismalarListesi;