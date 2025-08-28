import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import './css/BanliPanel.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

function BanliPanel() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [banVerisi, setBanVerisi] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hata, setHata] = useState(null);
    
    const [page, setPage] = useState({
        sorular: 1,
        yorumlar: 1,
        paylasimlar: 1,
        tartismalar: 1,
        tartismaYorumlari: 1,
    });

    useEffect(() => {
        if (!currentUser || !currentUser.isBanned) {
            navigate('/main');
            return;
        }

        const fetchBanVerisi = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/banli-panel-verisi/${currentUser.id}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Veri alınamadı.');
                }
                
                setBanVerisi(data);
                
            } catch (err) {
                console.error("API hatası:", err);
                setHata(err.message || 'Veri yüklenirken bir hata oluştu.');
            } finally {
                setLoading(false);
            }
        };

        fetchBanVerisi();
    }, [currentUser, navigate]);

    const handlePageChange = (tabName, newPage) => {
        setPage(prev => ({ ...prev, [tabName]: newPage }));
    };
    
    // GÜNCELLENDİ: Haksız ban bildirimini SweetAlert ile gönderen fonksiyon
    const handleHaksizBanBildirimi = () => {
        Swal.fire({
            title: 'Haksız Ban Bildirimi',
            text: 'Yetkililere gönderilecek mesajınızı buraya yazın:',
            input: 'textarea',
            inputPlaceholder: 'Durumu açıklayın...',
            showCancelButton: true,
            confirmButtonText: 'Gönder',
            cancelButtonText: 'İptal',
            showLoaderOnConfirm: true,
            preConfirm: async (mesaj) => {
                if (!mesaj) {
                    Swal.showValidationMessage('Lütfen bir mesaj yazın.');
                    return false;
                }
                // API isteği burada yapılacak
                try {
                    const response = await fetch('http://localhost:5000/api/ban-itirazi', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            user_id: currentUser.id, 
                            content: mesaj
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'İtiraz gönderilirken bir hata oluştu.');
                    }

                    return true;
                } catch (error) {
                    Swal.showValidationMessage(`Hata: ${error.message}`);
                    return false;
                }
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire('Başarılı!', 'İtirazınız yetkililere iletildi.', 'success');
            }
        });
    };
    
    if (loading) {
        return (
            <div className="banli-panel-container">
                <div className="loading-ekrani">Yükleniyor...</div>
            </div>
        );
    }
    
    if (hata) {
        return (
            <div className="banli-panel-container">
                <div className="hata-ekrani">{hata}</div>
            </div>
        );
    }
    
    if (!banVerisi || !banVerisi.banInfo) {
        return (
            <div className="banli-panel-container">
                <div className="hata-ekrani">Ban bilgisi alınamadı veya bir hata oluştu. Lütfen tekrar deneyin.</div>
            </div>
        );
    }

    const { banInfo, uyarilar, sorular, yorumlar, paylasimlar, tartismalar, tartismaYorumlari } = banVerisi;
    
    const renderIcerik = (data, tabName) => {
        const itemsPerPage = 10;
        const startIndex = (page[tabName] - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentItems = data.slice(startIndex, endIndex);
        const totalPages = Math.ceil(data.length / itemsPerPage);
        
        if (data.length === 0) return <p className="text-muted">Bu kategoride içerik bulunamadı.</p>;

        return (
            <>
                <ul className="list-group list-group-flush">
                    {currentItems.map((item, index) => (
                        <li key={`${item.id}-${index}`} className="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <strong>{item.title || item.content.substring(0, 50) + '...'}</strong>
                                <p className="mb-0 text-muted small">{item.content ? item.content.substring(0, 100) + '...' : ''}</p>
                            </div>
                            <small className="text-muted">{new Date(item.date).toLocaleDateString('tr-TR')}</small>
                        </li>
                    ))}
                </ul>
                {totalPages > 1 && (
                    <nav className="mt-3">
                        <ul className="pagination justify-content-center">
                            {[...Array(totalPages)].map((_, i) => (
                                <li key={i} className={`page-item ${page[tabName] === i + 1 ? 'active' : ''}`}>
                                    <button className="page-link" onClick={() => handlePageChange(tabName, i + 1)}>{i + 1}</button>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
            </>
        );
    };

    return (
        <div className="banli-panel-container">
            <div className="container">
                <div className="ban-uyari-kart">
                    <h2>Hesabınız Askıya Alınmış</h2>
                    <p className="ban-sebebi"><strong>Sebep:</strong> {banInfo.sebep}</p>
                    <p className="ban-tarihi"><strong>Ban Başlangıç Tarihi:</strong> {new Date(banInfo.ban_tarihi).toLocaleDateString('tr-TR')}</p>
                    <button className="btn itiraz-butonu" onClick={handleHaksizBanBildirimi}>Haksız Ban Bildirimi Yap</button>
                </div>
                
                <div className="icerik-kartlari">
                    <h3>İçerikleriniz</h3>
                    <div className="accordion" id="icerikAccordion">
                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseUyarilar">
                                    Aldığınız Uyarılar ({uyarilar.length})
                                </button>
                            </h2>
                            <div id="collapseUyarilar" className="accordion-collapse collapse show" data-bs-parent="#icerikAccordion">
                                <div className="accordion-body">
                                    {uyarilar.length === 0 ? <p className="text-muted">Hesabınızda uyarı bulunmamaktadır.</p> :
                                    <ul className="list-group list-group-flush">
                                        {uyarilar.map(uyari => (
                                            <li key={uyari.id} className="list-group-item">
                                                <strong>Sebep:</strong> {uyari.sebep} <br />
                                                <small className="text-muted">Tarih: {new Date(uyari.tarih).toLocaleDateString('tr-TR')}</small>
                                            </li>
                                        ))}
                                    </ul>}
                                </div>
                            </div>
                        </div>

                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePaylasimlar">
                                    Paylaşımlarınız ({paylasimlar.length})
                                </button>
                            </h2>
                            <div id="collapsePaylasimlar" className="accordion-collapse collapse" data-bs-parent="#icerikAccordion">
                                <div className="accordion-body">
                                    {renderIcerik(paylasimlar, 'paylasimlar')}
                                </div>
                            </div>
                        </div>

                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSorular">
                                    Sorduğunuz Sorular ({sorular.length})
                                </button>
                            </h2>
                            <div id="collapseSorular" className="accordion-collapse collapse" data-bs-parent="#icerikAccordion">
                                <div className="accordion-body">
                                    {renderIcerik(sorular, 'sorular')}
                                </div>
                            </div>
                        </div>

                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseYorumlar">
                                    Yaptığınız Yorumlar ({yorumlar.length})
                                </button>
                            </h2>
                            <div id="collapseYorumlar" className="accordion-collapse collapse" data-bs-parent="#icerikAccordion">
                                <div className="accordion-body">
                                    {renderIcerik(yorumlar, 'yorumlar')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BanliPanel;