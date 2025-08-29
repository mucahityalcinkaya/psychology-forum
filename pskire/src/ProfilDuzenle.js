import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

function ProfilDuzenle() {
  // AuthContext'ten sadece currentUser değil, onu güncelleyecek fonksiyonu da alıyoruz.
  // Not: Bu fonksiyonu AuthContext.js dosyanızda tanımlamanız gerekir (aşağıda örneği var).
  const { currentUser, updateUser } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    age: '',
    gender: 'erkek' // Varsayılan değer
  });

  // --- YENİ STATE'LER ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (currentUser) {
      // Veritabanından gelen tarih (datetime) formatını input'un beklediği (YYYY-MM-DD) formatına çeviriyoruz.
      const formattedAge = currentUser.age ? new Date(currentUser.age).toISOString().split('T')[0] : '';
      setFormData({
        name: currentUser.name || '',
        surname: currentUser.surname || '',
        email: currentUser.email || '',
        age: formattedAge,
        gender: currentUser.gender || 'erkek',
      });
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- GÜNCELLENMİŞ handleSubmit FONKSİYONU ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/kullanicilar/${currentUser.id}/profil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Bir hata oluştu.');
      }

      setSuccess(data.message);
      // Context'teki kullanıcı bilgisini anında güncelle
      if (updateUser) {
        updateUser(data.user);
      }
      
      // Kullanıcının başarı mesajını görmesi için 2 saniye sonra yönlendir
      setTimeout(() => {
        navigate('/profilim');
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-5">
      <h2 className="mb-4">Profili Düzenle</h2>
      <div className="card shadow-sm">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="name" className="form-label">Ad</label>
                <input type="text" id="name" name="name" className="form-control" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="surname" className="form-label">Soyad</label>
                <input type="text" id="surname" name="surname" className="form-control" value={formData.surname} onChange={handleChange} required />
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">E-posta Adresi</label>
              <input type="email" id="email" name="email" className="form-control" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="age" className="form-label">Doğum Tarihi</label>
                <input type="date" id="age" name="age" className="form-control" value={formData.age} onChange={handleChange} />
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="gender" className="form-label">Cinsiyet</label>
                <select id="gender" name="gender" className="form-select" value={formData.gender} onChange={handleChange}>
                  <option value="erkek">Erkek</option>
                  <option value="kadin">Kadın</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Güncelleniyor...' : 'Güncelle'}
              </button>
              <Link to="/profilim" className="btn btn-secondary ms-2">İptal</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfilDuzenle;