// DOSYA: src/TartismaEkle.js

import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import './css/TartismaEkle.css'; // Stil dosyanız

function TartismaEkle() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            Swal.fire('Eksik Bilgi', 'Lütfen bir başlık girin.', 'warning');
            return;
        }

        if (!currentUser) {
            Swal.fire('Giriş Gerekli', 'Tartışma başlatmak için lütfen giriş yapınız.', 'warning');
            navigate('/login');
            return;
        }

        setIsSubmitting(true);
        try {
            // API endpoint'ine POST isteği atıyoruz.
            const response = await fetch('http://localhost:5000/api/tartismaekle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // API'nin tam olarak beklediği 'title', 'content' ve 'user_id' alanlarını gönderiyoruz.
                body: JSON.stringify({
                    title: title.trim(),
                    content: content.trim(),
                    user_id: currentUser.id
                })
            });

            const data = await response.json();
            if (!response.ok) {
                // API'den gelen hata mesajını gösteriyoruz.
                throw new Error(data.message || 'Bir hata oluştu.');
            }

            // API'den başarılı yanıt (ve yeni tartışmanın ID'si) geldiğinde,
            // kullanıcıyı yeni tartışmanın sayfasına yönlendiriyoruz.
            await Swal.fire({
                icon: 'success',
                title: 'Başarılı!',
                text: 'Tartışmanız başarıyla başlatıldı!',
                timer: 2000,
                showConfirmButton: false,
            });

            navigate(`/tartismalar/${data.id}`);

        } catch (err) {
            Swal.fire('Hata!', err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="tartisma-ekle-container">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-lg-8">

                        <div className="tartisma-ekle-header">
                            <Link to="/tartismalar" className="btn back-button"><i className="bi bi-arrow-left"></i></Link>
                            <h1 className="page-title">Yeni Tartışma Başlat</h1>
                        </div>

                        <div className="card tartisma-card">
                            <div className="card-body tartisma-card-body">
                                <form onSubmit={handleSubmit}>
                                    <div className="form-group">
                                        <label htmlFor="title" className="form-label">Tartışma Başlığı</label>
                                        <input
                                            type="text"
                                            className="form-control custom-input"
                                            id="title"
                                            placeholder="Konuyu özetleyen bir başlık girin..."
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="content" className="form-label">Açıklama (İsteğe Bağlı)</label>
                                        <textarea
                                            className="form-control custom-textarea"
                                            id="content"
                                            placeholder="Fikirlerinizi ve tartışma konusunu detaylandırın..."
                                            rows="6"
                                            value={content}
                                            onChange={e => setContent(e.target.value)}
                                        />
                                    </div>
                                    <div className="submit-btn-container">
                                        <button type="submit" className={`btn submit-btn ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
                                            {isSubmitting ? 'Oluşturuluyor...' : 'Tartışmayı Oluştur'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TartismaEkle;