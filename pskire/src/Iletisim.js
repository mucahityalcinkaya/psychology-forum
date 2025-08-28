import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Swal from 'sweetalert2';
import './css/iletisim.css';

function Iletisim() {
    const { currentUser } = useAuth();

    // Form state'leri
    const [iletisimTurleri, setIletisimTurleri] = useState([]);
    const [turId, setTurId] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Gönderilmiş mesajlar için state'ler
    const [mesajlarimGoster, setMesajlarimGoster] = useState(false);
    const [gonderilenMesajlar, setGonderilenMesajlar] = useState([]);
    const [mesajlarYukleniyor, setMesajlarYukleniyor] = useState(false);

    // Component yüklendiğinde iletişim türlerini API'den çeker
    useEffect(() => {
        const fetchIletisimTurleri = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/iletisim-turleri');
                const data = await response.json();
                if (!response.ok) throw new Error('İletişim türleri yüklenemedi.');
                setIletisimTurleri(data);
            } catch (error) {
                console.error(error);
                Swal.fire('Hata!', 'Sayfa yüklenirken bir sorun oluştu.', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchIletisimTurleri();
    }, []);

    // Kullanıcının gönderdiği mesajları çeker
    const fetchGonderilenMesajlar = async () => {
        if (!currentUser) return;
        setMesajlarYukleniyor(true);
        try {
            const response = await fetch(`http://localhost:5000/api/kullanici/mesajlarim/${currentUser.id}`);
            const data = await response.json();
            if (!response.ok) throw new Error('Mesajlar yüklenemedi.');
            setGonderilenMesajlar(data);
        } catch (error) {
            console.error(error);
            Swal.fire('Hata!', error.message, 'error');
        } finally {
            setMesajlarYukleniyor(false);
        }
    };
    
    // "Gönderilenlere Bak" butonunun tıklama olayını yönetir
    const handleToggleMesajlarim = () => {
        const yeniDurum = !mesajlarimGoster;
        setMesajlarimGoster(yeniDurum);
        if (yeniDurum) {
            fetchGonderilenMesajlar();
        }
    };
    
    // Ana iletişim formunu gönderir
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!turId || !title.trim() || !content.trim()) {
            Swal.fire('Eksik Bilgi', 'Lütfen tüm zorunlu alanları doldurun.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                iletisim_tur_id: parseInt(turId),
                title: title.trim(),
                content: content.trim(),
                user_id: currentUser ? currentUser.id : null
            };

            const response = await fetch('http://localhost:5000/api/iletisim-mesaj-gonder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Bir hata oluştu.');

            await Swal.fire({
                icon: 'success',
                title: 'Gönderildi!',
                text: data.message,
            });
            
            setTurId('');
            setTitle('');
            setContent('');

            if (mesajlarimGoster) {
                fetchGonderilenMesajlar(); // Mesaj listesini de yenile
            }

        } catch (err) {
            Swal.fire('Hata!', err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading) return <div className="text-center my-5"><h3>Yükleniyor...</h3></div>;

    return (
        <div className="iletisim-container">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-lg-8">

                        <div className="iletisim-header">
                            <h1 className="page-title">Bize Ulaşın</h1>
                            <p className="page-subtitle">Öneri, şikayet veya herhangi bir konuda bizimle iletişime geçmekten çekinmeyin.</p>
                        </div>

                        <div className="card iletisim-card">
                            <div className="card-body iletisim-card-body">
                                <form onSubmit={handleSubmit}>
                                    <div className="form-group">
                                        <label htmlFor="turId" className="form-label">Konu</label>
                                        <select
                                            id="turId"
                                            className="form-select custom-select"
                                            value={turId}
                                            onChange={e => setTurId(e.target.value)}
                                            required
                                        >
                                            <option value="" disabled>Lütfen bir konu seçin...</option>
                                            {iletisimTurleri.map(tur => (
                                                <option key={tur.id} value={tur.id}>{tur.tur_adi}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="title" className="form-label">Başlık</label>
                                        <input
                                            type="text"
                                            className="form-control custom-input"
                                            id="title"
                                            placeholder="Mesajınızın başlığını girin..."
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="content" className="form-label">Mesajınız</label>
                                        <textarea
                                            className="form-control custom-textarea"
                                            id="content"
                                            placeholder="Mesajınızı buraya detaylı bir şekilde yazın..."
                                            rows="6"
                                            value={content}
                                            onChange={e => setContent(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="submit-btn-container">
                                        <button type="submit" className={`btn submit-btn ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
                                            {isSubmitting ? 'Gönderiliyor...' : 'Gönder'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {currentUser && (
                            <div className="text-center mt-4">
                                <button className="btn btn-secondary" onClick={handleToggleMesajlarim}>
                                    <i className={`bi bi-chevron-${mesajlarimGoster ? 'up' : 'down'} me-2`}></i>
                                    {mesajlarimGoster ? 'Mesajlarımı Gizle' : 'Gönderdiğim Mesajlara Bak'}
                                </button>
                            </div>
                        )}

                        {mesajlarimGoster && (
                            <div className="card iletisim-card mt-4">
                                <div className="card-body iletisim-card-body">
                                    <h4 className="mb-3">Gönderdiğim Mesajlar</h4>
                                    {mesajlarYukleniyor ? <p>Yükleniyor...</p> :
                                        gonderilenMesajlar.length === 0 ? <p>Daha önce hiç mesaj göndermemişsiniz.</p> :
                                        <div className="accordion" id="mesajlarAccordion">
                                            {gonderilenMesajlar.map((mesaj) => (
                                                <div className="accordion-item" key={mesaj.id}>
                                                    <h2 className="accordion-header" id={`heading-${mesaj.id}`}>
                                                        <button 
                                                            className={`accordion-button collapsed ${mesaj.durum === 'Yeni' ? 'yeni-mesaj' : ''}`} 
                                                            type="button" data-bs-toggle="collapse" 
                                                            data-bs-target={`#collapse-${mesaj.id}`}
                                                        >
                                                            <span className={`badge me-2 ${mesaj.durum === 'Cevaplandı' ? 'bg-success' : 'bg-info'}`}>{mesaj.tur_adi}</span>
                                                            {mesaj.title}
                                                            <small className="ms-auto text-muted">{new Date(mesaj.gonderim_tarihi).toLocaleDateString('tr-TR')}</small>
                                                        </button>
                                                    </h2>
                                                    <div id={`collapse-${mesaj.id}`} className="accordion-collapse collapse" data-bs-parent="#mesajlarAccordion">
                                                        <div className="accordion-body">
                                                            <strong>Mesajım:</strong>
                                                            <p style={{whiteSpace: 'pre-wrap'}}>{mesaj.content}</p>
                                                            <hr/>
                                                            <strong>Gelen Cevaplar:</strong>
                                                            {mesaj.cevaplar && mesaj.cevaplar.length > 0 ? (
                                                                mesaj.cevaplar.map(cevap => (
                                                                    <div key={cevap.id} className="alert alert-secondary mt-2">
                                                                        <strong>Yetkili ({cevap.user_name}):</strong>
                                                                        <p className="mb-0 mt-1" style={{whiteSpace: 'pre-wrap'}}>{cevap.content}</p>
                                                                        <small className="d-block text-end">{new Date(cevap.cevap_tarihi).toLocaleString('tr-TR')}</small>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <p className="text-muted">Bu mesajınıza henüz cevap verilmemiş.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Iletisim;