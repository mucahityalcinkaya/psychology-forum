import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './css/SoruSor.css';
import Swal from 'sweetalert2';

function SoruSor() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [tumHastaliklar, setTumHastaliklar] = useState([]);
    const [tumIlaclar, setTumIlaclar] = useState([]);

    const [secilenHastaliklar, setSecilenHastaliklar] = useState([]);
    const [secilenIlaclar, setSecilenIlaclar] = useState([]);

    const [hastalikSecimi, setHastalikSecimi] = useState('');
    const [ilacSecimi, setIlacSecimi] = useState('');

    // YENİ EKLENEN STATE'LER: Fotoğraflar için
    const [files, setFiles] = useState([]);
    const [filePreviews, setFilePreviews] = useState([]);

    useEffect(() => {
        const fetchEtiketVerileri = async () => {
            try {
                const response = await fetch('/api/sorularlistesi');
                const data = await response.json();
                setTumHastaliklar(data.tumHastaliklar || []);
                setTumIlaclar(data.tumIlaclar || []);
            } catch (error) {
                console.error("Etiket verileri çekilirken hata:", error);
                Swal.fire('Hata!', 'Etiket verileri yüklenemedi.', 'error');
            }
        };
        fetchEtiketVerileri();
    }, []);

    const handleHastalikEkle = () => {
        if (!hastalikSecimi) return;
        if (secilenHastaliklar.some(h => h.id === parseInt(hastalikSecimi))) {
            Swal.fire({ icon: 'warning', title: 'Bu Hastalık Zaten Eklendi!', timer: 1500, showConfirmButton: false });
            return;
        }
        const hastalik = tumHastaliklar.find(h => h.id === parseInt(hastalikSecimi));
        if (hastalik) {
            setSecilenHastaliklar([...secilenHastaliklar, hastalik]);
            setHastalikSecimi('');
        }
    };

    const handleIlacEkle = () => {
        if (!ilacSecimi) return;
        if (secilenIlaclar.some(i => i.id === parseInt(ilacSecimi))) {
            Swal.fire({ icon: 'warning', title: 'Bu İlaç Zaten Eklendi!', timer: 1500, showConfirmButton: false });
            return;
        }
        const ilac = tumIlaclar.find(i => i.id === parseInt(ilacSecimi));
        if (ilac) {
            setSecilenIlaclar([...secilenIlaclar, ilac]);
            setIlacSecimi('');
        }
    };

    const handleEtiketKaldir = (id, type) => {
        if (type === 'hastalik') {
            setSecilenHastaliklar(secilenHastaliklar.filter(h => h.id !== id));
        } else {
            setSecilenIlaclar(secilenIlaclar.filter(i => i.id !== id));
        }
    };

    // YENİ EKLEME: Dosya seçimini yöneten fonksiyon
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const newFiles = [...files, ...selectedFiles];

        if (newFiles.length > 10) {
            alert("En fazla 10 fotoğraf yükleyebilirsiniz.");
            return;
        }

        setFiles(newFiles);
        const newPreviews = newFiles.map(file => URL.createObjectURL(file));
        setFilePreviews(newPreviews);
    };

    // YENİ EKLEME: Dosya kaldırmayı yöneten fonksiyon
    const handleFileRemove = (index) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        setFiles(newFiles);

        const newPreviews = [...filePreviews];
        URL.revokeObjectURL(newPreviews[index]);
        newPreviews.splice(index, 1);
        setFilePreviews(newPreviews);
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        
        if (!currentUser) {
            Swal.fire('Giriş Gerekli', 'Soru sormak için lütfen giriş yapınız.', 'warning');
            navigate('/login');
            return;
        }
        
        if (!title.trim() || !content.trim()) {
            Swal.fire('Eksik Bilgi', 'Lütfen Soru Başlığı ve İçerik alanlarını doldurun.', 'error');
            return;
        }

        setIsSubmitting(true);

        const formData = new FormData();
        
        formData.append('soru', JSON.stringify({
            user_id: currentUser.id,
            title: title.trim(),
            content: content.trim(),
            isAnonymous: isAnonymous,
            hastaliklar: secilenHastaliklar.map(h => h.id),
            ilaclar: secilenIlaclar.map(i => i.id)
        }));

        files.forEach(file => {
            formData.append('images', file);
        });

        try {
            const response = await fetch('/api/sorusor', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Bir hata oluştu.');
            }

            await Swal.fire({
                icon: 'success',
                title: 'Başarılı!',
                text: 'Sorunuz başarıyla gönderildi! 🎉',
                timer: 2000,
                showConfirmButton: false,
            });
            navigate('/sorular');

        } catch (error) {
            Swal.fire('Hata!', error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="soru-sor-container">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-lg-8">
                        
                        <div className="soru-sor-header">
                            <Link to="/sorular" className="btn back-button"><i className="bi bi-arrow-left"></i></Link>
                            <h1 className="page-title">Topluluğa Soru Sor</h1>
                        </div>

                        <div className="card soru-card">
                            <div className="card-body soru-card-body">
                                <form onSubmit={handleSubmit}>
                                    
                                    <div className="form-group">
                                        <label htmlFor="title" className="form-label">Soru Başlığı</label>
                                        <input 
                                            type="text" 
                                            className="form-control custom-input" 
                                            id="title" 
                                            placeholder="Sorunuzu kısa ve net bir şekilde özetleyin..."
                                            value={title} 
                                            onChange={e => setTitle(e.target.value)} 
                                            required 
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="content" className="form-label">Sorunuzun Detayları</label>
                                        <textarea 
                                            className="form-control custom-textarea" 
                                            id="content" 
                                            placeholder="Sorunuzun detaylarını, yaşadığınız durumu veya merak ettiğiniz konuyu açıklayın..."
                                            rows="6" 
                                            value={content} 
                                            onChange={e => setContent(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="file-input" className="form-label">Fotoğraf Ekle ({files.length}/10)</label>
                                        <input 
                                            type="file" 
                                            id="file-input" 
                                            className="form-control" 
                                            multiple 
                                            accept="image/*"
                                            onChange={handleFileChange} 
                                            disabled={files.length >= 10}
                                        />
                                        {filePreviews.length > 0 && (
                                            <div className="d-flex flex-wrap gap-2 mt-3">
                                                {filePreviews.map((preview, index) => (
                                                    <div key={index} className="preview-container">
                                                        <img src={preview} alt={`preview-${index}`} className="img-thumbnail" />
                                                        <button 
                                                            type="button" 
                                                            className="btn-close remove-btn" 
                                                            onClick={() => handleFileRemove(index)}
                                                        ></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <hr className="section-divider" />
                                    
                                    <h5 className='tags-title'>Soru Etiketleri <small className="text-muted">(İsteğe Bağlı)</small></h5>

                                    <div className="form-group">
                                        <label htmlFor="hastalikSecimi" className="form-label">İlgili Hastalıklar</label>
                                        <div className="tag-input-group">
                                            <select 
                                                className="form-select custom-select" 
                                                id="hastalikSecimi" 
                                                value={hastalikSecimi} 
                                                onChange={e => setHastalikSecimi(e.target.value)}
                                            >
                                                <option value="">Hastalık seçin...</option>
                                                {tumHastaliklar.map(h => (
                                                    <option key={h.id} value={h.id}>{h.illness_name}</option>
                                                ))}
                                            </select>
                                            <button type="button" className="btn add-tag-btn" onClick={handleHastalikEkle}>
                                                <i className="bi bi-plus-circle me-2"></i>Ekle
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="ilacSecimi" className="form-label">İlgili İlaçlar</label>
                                        <div className="tag-input-group">
                                            <select 
                                                className="form-select custom-select" 
                                                id="ilacSecimi" 
                                                value={ilacSecimi} 
                                                onChange={e => setIlacSecimi(e.target.value)}
                                            >
                                                <option value="">İlaç seçin...</option>
                                                {tumIlaclar.map(i => (
                                                    <option key={i.id} value={i.id}>{i.medicine_name}</option>
                                                ))}
                                            </select>
                                            <button type="button" className="btn add-tag-btn" onClick={handleIlacEkle}>
                                                <i className="bi bi-plus-circle me-2"></i>Ekle
                                            </button>
                                        </div>
                                    </div>

                                    {(secilenHastaliklar.length > 0 || secilenIlaclar.length > 0) && (
                                        <div className="selected-tags-container">
                                            <h6 className="selected-tags-title"><i className="bi bi-tags-fill me-2"></i>Seçilen Etiketler:</h6>
                                            <div className="tags-wrapper">
                                                {secilenHastaliklar.map(h => (
                                                    <span key={h.id} className="badge tag-badge illness-tag">
                                                        <i className="bi bi-heart-pulse me-1"></i>
                                                        {h.illness_name}
                                                        <i className="bi bi-x-circle tag-remove" onClick={() => handleEtiketKaldir(h.id, 'hastalik')}/>
                                                    </span>
                                                ))}
                                                {secilenIlaclar.map(i => (
                                                    <span key={i.id} className="badge tag-badge medicine-tag">
                                                        <i className="bi bi-capsule me-1"></i>
                                                        {i.medicine_name}
                                                        <i className="bi bi-x-circle tag-remove" onClick={() => handleEtiketKaldir(i.id, 'ilac')}/>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="anonymous-switch-container">
                                        <div className="anonymous-icon"><i className="bi bi-incognito"></i></div>
                                        <div className="anonymous-content">
                                            <input className="form-check-input" type="checkbox" role="switch" id="isAnonymous" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} />
                                            <div className="anonymous-text-wrapper">
                                                <label className="anonymous-label" htmlFor="isAnonymous">
                                                    <div className="anonymous-title">Anonim Olarak Sor</div>
                                                    <p className="anonymous-desc">Kimliğiniz gizli kalır</p>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="submit-btn-container">
                                        <button type="submit" className={`btn submit-btn ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
                                            {isSubmitting ? (
                                                <span>Gönderiliyor...</span>
                                            ) : (
                                                <><i className="bi bi-send-fill me-2"></i>Sorumu Gönder</>
                                            )}
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

export default SoruSor;