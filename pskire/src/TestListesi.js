import React, { useState, useEffect } from 'react'; // React kütüphanesi ve hook'ları import et
import { Link } from 'react-router-dom'; // Sayfa yönlendirmeleri için Link component'ini import et
import { useAuth } from './context/AuthContext'; // Yetki kontrolü için AuthContext'i import et
import './css/TestListesi.css'; // Bu bileşene özel CSS dosyasını import et

function TestListesi() {
    // ============================================
    // STATE TANIMLAMA - Bileşenin durumunu yönetmek için
    // ============================================
    const [testler, setTestler] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // AuthContext'ten mevcut kullanıcıyı al
    const { currentUser } = useAuth();

    // ============================================
    // VERİ ÇEKME - Component yüklendiğinde API'den veri çekmek için
    // ============================================
    useEffect(() => {
        setLoading(true);
        fetch('http://localhost:5000/api/testler')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Veri alınırken bir sorun oluştu.');
                }
                return response.json();
            })
            .then(data => {
                setTestler(data);
            })
            .catch(error => {
                console.error("API'dan test verisi çekerken hata oluştu:", error);
                setError(error.message);
            })
            .finally(() => {
                setLoading(false);
            });
            
    }, []); // Dependency array boş [] = sadece component ilk yüklendiğinde çalış

    // ============================================
    // RENDER KISMI - UI'ın nasıl görüneceğini belirler
    // ============================================

    if (loading) return <div className="text-center my-5"><h3>Testler Yükleniyor...</h3></div>;
    if (error) return <div className="container my-5 alert alert-danger">{error}</div>;

    return (
        <div className="test-listesi-container">
            <div className="container py-5">
                
                {/* SAYFA BAŞLIĞI VE AÇIKLAMA */}
                <div className="text-center mb-5 test-header">
                    <h1 className="page-title mb-3">Ruh Sağlığı Farkındalık Testleri</h1>
                    <p className="page-description">
                        Kendinizi daha iyi anlamak ve içgörü kazanmak için aşağıdaki testlerden birini seçebilirsiniz.
                        <br />
                        Unutmayın, bu testler teşhis amaçlı değildir ve profesyonel bir görüşün yerini tutmaz.
                    </p>
                </div>

                {/* --- YENİ EKLENEN BUTON --- */}
                {/* Sadece rolü 'admin' veya 'moderator' olan kullanıcılar bu butonu görür */}
                {(currentUser?.rol === 'admin' || currentUser?.rol === 'moderator') && (
                    <div className="text-center mb-5">
                        <Link to="/testekle" className="btn btn-primary btn-lg">
                           <i className="bi bi-plus-circle-fill me-2"></i>
                           Yeni Test Ekle
                        </Link>
                    </div>
                )}
                {/* ------------------------- */}

                {/* TEST KARTLARI LİSTESİ */}
                <div className="row">
                    
                    {/* MAP FONKSİYONU - Her test için bir kart oluştur */}
                    {testler.map(test => (
                        // testler array'indeki her test objesi için bu JSX'i tekrarla
                        // test: Mevcut döngüdeki test objesi (örn: {id: 1, title: "...", description: "..."})
                        
                        <div key={test.id} className="col-lg-4 col-md-6 mb-4">
                            {/* key={test.id}: React'in hangi element'in değiştiğini anlaması için benzersiz anahtar */}
                            
                            {/* TEST KARTINA TIKLANABİLİR LİNK */}
                            <Link to={`/test/${test.id}`} className="card-link">
                                {/* Link: React Router'ın navigation component'i */}
                                {/* to={`/test/${test.id}`}: Template literal ile dinamik URL */}
                                
                                {/* FLIP KART ANIMASYONU */}
                                <div className="flip-card">
                                    <div className="flip-card-inner">
                                        
                                        {/* KARTIN ÖN YÜZÜ */}
                                        <div className="flip-card-front">
                                            <i className="bi bi-clipboard2-pulse-fill card-icon"></i>
                                            <h5 className="card-title-front">{test.title}</h5>
                                            <p className="card-text-front">{test.description}</p>
                                        </div>
                                        
                                        {/* KARTIN ARKA YÜZÜ */}
                                        <div className="flip-card-back">
                                            <h5 className="card-title-back">{test.title}</h5>
                                            <p className="card-text-back">{test.advice}</p>
                                            <div className="start-test-btn">
                                                Teste Başla
                                            </div>
                                        </div>
                                        
                                    </div>
                                </div>
                            </Link>
                        </div>
                    ))}
                    {/* map fonksiyonu sonu */}
                    
                </div> {/* row div'i sonu */}
            </div> {/* container div'i sonu */}
        </div>
    );
}

// ============================================
// EXPORT - Bu component'i diğer dosyalarda kullanılabilir hale getir
// ============================================
export default TestListesi;