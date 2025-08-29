import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

function TestEkle() {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // --- STATE'LER ---
    const [testDetaylari, setTestDetaylari] = useState({ title: '', description: '', advice: '' });
    const [sonuclar, setSonuclar] = useState([{ id: '', baslik: '', aciklama: '' }]);
    const [sorular, setSorular] = useState([{
        reactKey: Date.now(), 
        soru_metni: '',
        imageFile: null,
        cevaplar: [{ reactKey: Date.now() + 1, metin: '', puan_tipi: '' }]
    }]);
    
    const [tumSonucTipleri, setTumSonucTipleri] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sayfa yüklendiğinde mevcut tüm sonuç tiplerini çeker
    useEffect(() => {
        const fetchSonucTipleri = async () => {
            try {
                const response = await fetch('/api/test-sonuclari');
                if (!response.ok) throw new Error('Sonuç tipleri yüklenemedi.');
                const data = await response.json();
                setTumSonucTipleri(data);
            } catch (error) {
                console.error(error);
                Swal.fire('Hata!', error.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchSonucTipleri();
    }, []);

    // --- FORM İÇERİĞİNİ GÜNCELLEYEN FONKSİYONLAR ---
    const handleTestDetayChange = (e) => setTestDetaylari({ ...testDetaylari, [e.target.name]: e.target.value });

    const handleSonucChange = (index, e) => {
        const newSonuclar = [...sonuclar];
        if (e.target.name === 'id') {
            newSonuclar[index][e.target.name] = e.target.value.replace(/\s+/g, '-').toLowerCase();
        } else {
            newSonuclar[index][e.target.name] = e.target.value;
        }
        setSonuclar(newSonuclar);
    };

    const handleSoruChange = (index, e) => {
        const newSorular = [...sorular];
        if (e.target.name === 'imageFile') {
            newSorular[index].imageFile = e.target.files[0];
        } else {
            newSorular[index][e.target.name] = e.target.value;
        }
        setSorular(newSorular);
    };
    
    const handleCevapChange = (soruIndex, cevapIndex, e) => {
        const newSorular = [...sorular];
        newSorular[soruIndex].cevaplar[cevapIndex][e.target.name] = e.target.value;
        setSorular(newSorular);
    };

    // --- FORMA DİNAMİK OLARAK ALAN EKLEYİP ÇIKARAN FONKSİYONLAR ---
    const addSonuc = () => setSonuclar([...sonuclar, { id: '', baslik: '', aciklama: '' }]);
    const removeSonuc = (index) => setSonuclar(sonuclar.filter((_, i) => i !== index));

    const addSoru = () => setSorular([...sorular, { reactKey: Date.now(), soru_metni: '', imageFile: null, cevaplar: [{ reactKey: Date.now() + 1, metin: '', puan_tipi: '' }] }]);
    const removeSoru = (index) => setSorular(sorular.filter((_, i) => i !== index));
    
    const addCevap = (soruIndex) => {
        const newSorular = [...sorular];
        newSorular[soruIndex].cevaplar.push({ reactKey: Date.now(), metin: '', puan_tipi: '' });
        setSorular(newSorular);
    };
    const removeCevap = (soruIndex, cevapIndex) => {
        const newSorular = [...sorular];
        newSorular[soruIndex].cevaplar = newSorular[soruIndex].cevaplar.filter((_, i) => i !== cevapIndex);
        setSorular(newSorular);
    };

    // --- ANA FORM GÖNDERME FONKSİYONU ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!testDetaylari.title || !testDetaylari.description || !testDetaylari.advice) {
            return Swal.fire('Eksik Bilgi', 'Lütfen testin genel bilgilerini doldurun.', 'warning');
        }
        for (const sonuc of sonuclar) {
            if (!sonuc.id || !sonuc.baslik || !sonuc.aciklama) {
                return Swal.fire('Eksik Bilgi', 'Lütfen tüm sonuç alanlarını (ID, Başlık, Açıklama) doldurun.', 'warning');
            }
        }
        for (const soru of sorular) {
            if (!soru.soru_metni) {
                return Swal.fire('Eksik Bilgi', 'Lütfen tüm soru metinlerini doldurun.', 'warning');
            }
            for (const cevap of soru.cevaplar) {
                if (!cevap.metin || !cevap.puan_tipi) {
                    return Swal.fire('Eksik Bilgi', 'Lütfen tüm cevaplar için metin girin ve bir puan tipi seçin.', 'warning');
                }
            }
        }

        setIsSubmitting(true);
        const formData = new FormData();
        const testData = {
            testDetaylari,
            sonuclar,
            sorular: sorular.map(s => ({
                soru_metni: s.soru_metni,
                cevaplar: s.cevaplar.map(c => ({
                    metin: c.metin,
                    puan_tipi: c.puan_tipi
                }))
            }))
        };
        formData.append('testData', JSON.stringify(testData));

        sorular.forEach((soru, index) => {
            if (soru.imageFile) {
                formData.append(`soru_resim_${index}`, soru.imageFile);
            }
        });

        try {
            const response = await fetch('/api/testekle', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            
            await Swal.fire('Başarılı!', 'Test başarıyla oluşturuldu.', 'success');
            navigate(`/testler`);
        } catch (error) {
            Swal.fire('Hata!', error.message || 'Test oluşturulurken bir hata oluştu.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading) return <div className="text-center my-5"><h3>Yükleniyor...</h3></div>;

    return (
        <div className="container my-5">
            <h1 className="mb-4">Yeni Test Oluştur</h1>
            <form onSubmit={handleSubmit}>
                {/* 1. Test Detayları */}
                <div className="card mb-4">
                    <div className="card-header"><h4>Test Genel Bilgileri</h4></div>
                    <div className="card-body">
                        <div className="mb-3">
                            <label className="form-label">Test Başlığı</label>
                            <input type="text" name="title" value={testDetaylari.title} onChange={handleTestDetayChange} className="form-control" required />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Açıklama (Liste sayfasında görünecek)</label>
                            <textarea name="description" value={testDetaylari.description} onChange={handleTestDetayChange} className="form-control" rows="3" required></textarea>
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Tavsiye (Test sonunda görünecek)</label>
                            <textarea name="advice" value={testDetaylari.advice} onChange={handleTestDetayChange} className="form-control" rows="3" required></textarea>
                        </div>
                    </div>
                </div>

                {/* 2. Sonuç Tanımları */}
                <div className="card mb-4">
                    <div className="card-header"><h4>Test Sonuçlarını Tanımla</h4></div>
                    <div className="card-body">
                        {sonuclar.map((sonuc, index) => (
                            <div key={index} className="row align-items-center mb-3 border p-3 rounded">
                                <div className="col-md-3">
                                    <label className="form-label">Sonuç ID (örn: anksiyete-egilim)</label>
                                    <input type="text" name="id" value={sonuc.id} onChange={(e) => handleSonucChange(index, e)} className="form-control" required/>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Sonuç Başlığı (örn: Anksiyete Eğilimi)</label>
                                    <input type="text" name="baslik" value={sonuc.baslik} onChange={(e) => handleSonucChange(index, e)} className="form-control" required/>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Sonuç Açıklaması</label>
                                    <input type="text" name="aciklama" value={sonuc.aciklama} onChange={(e) => handleSonucChange(index, e)} className="form-control" required/>
                                </div>
                                <div className="col-md-1">
                                    <button type="button" onClick={() => removeSonuc(index)} className="btn btn-danger mt-4">X</button>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addSonuc} className="btn btn-outline-primary">Yeni Sonuç Ekle</button>
                    </div>
                </div>

                {/* 3. Sorular ve Cevaplar */}
                {sorular.map((soru, soruIndex) => (
                    <div key={soru.reactKey} className="card mb-4">
                        <div className="card-header d-flex justify-content-between align-items-center">
                            <h4>Soru {soruIndex + 1}</h4>
                            <button type="button" onClick={() => removeSoru(soruIndex)} className="btn btn-danger">Soruyu Sil</button>
                        </div>
                        <div className="card-body">
                            <div className="mb-3">
                                <label className="form-label">Soru Metni</label>
                                <input type="text" name="soru_metni" value={soru.soru_metni} onChange={(e) => handleSoruChange(soruIndex, e)} className="form-control" required />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Soru Resmi</label>
                                <input type="file" name="imageFile" onChange={(e) => handleSoruChange(soruIndex, e)} className="form-control" />
                            </div>
                            <hr />
                            <h5>Cevaplar</h5>
                            {soru.cevaplar.map((cevap, cevapIndex) => (
                                <div key={cevap.reactKey} className="row align-items-center mb-2">
                                    <div className="col-md-5">
                                        <input type="text" name="metin" value={cevap.metin} onChange={(e) => handleCevapChange(soruIndex, cevapIndex, e)} className="form-control" placeholder="Cevap metni..." required />
                                    </div>
                                    <div className="col-md-5">
                                        <select name="puan_tipi" value={cevap.puan_tipi} onChange={(e) => handleCevapChange(soruIndex, cevapIndex, e)} className="form-select" required>
                                            <option value="" disabled>Puan Tipi Seç...</option>
                                            <optgroup label="Bu Test İçin Tanımlananlar">
                                                {sonuclar
                                                    .filter(sonuc => sonuc.id.trim() !== '' && sonuc.baslik.trim() !== '')
                                                    .map(sonuc => (
                                                        <option key={`new-${sonuc.id}`} value={sonuc.id}>
                                                            {sonuc.baslik} ({sonuc.id})
                                                        </option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Mevcut Sonuç Tipleri">
                                                {tumSonucTipleri.map(sonuc => (
                                                    <option key={sonuc.id} value={sonuc.id}>
                                                        {sonuc.baslik} ({sonuc.id})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div className="col-md-2">
                                        <button type="button" onClick={() => removeCevap(soruIndex, cevapIndex)} className="btn btn-outline-danger">Cevabı Sil</button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => addCevap(soruIndex)} className="btn btn-outline-secondary mt-2">Yeni Cevap Ekle</button>
                        </div>
                    </div>
                ))}
                <button type="button" onClick={addSoru} className="btn btn-primary btn-lg mb-4">Yeni Soru Ekle</button>

                <div className="d-grid">
                    <button type="submit" className="btn btn-success btn-lg" disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : 'Tüm Testi Kaydet'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default TestEkle;