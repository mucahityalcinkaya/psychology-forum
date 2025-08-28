import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

function TakipListesi() {
  const { userId } = useParams();
  const { currentUser } = useAuth();
  const location = useLocation();

  const [aktifSekme, setAktifSekme] = useState('takipciler');
  const [listOwner, setListOwner] = useState(null);
  const [takipciler, setTakipciler] = useState([]);
  const [takipEdilenler, setTakipEdilenler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Görüntülenen liste mevcut kullanıcıya mı ait?
  const isMyList = currentUser && currentUser.id === parseInt(userId);

  useEffect(() => {
    // Profil sayfasından yönlendirme ile gelen sekme bilgisini al
    if (location.state?.varsayilanSekme) {
      setAktifSekme(location.state.varsayilanSekme);
    }
    
    const profilId = parseInt(userId);
    if (isNaN(profilId)) { 
  // profilId bir sayı değilse burası çalışır
    return;
}
    
    fetchTakipData(profilId);
  }, [userId, location.state]);

  const fetchTakipData = async (profilId) => {
    setLoading(true);
    setError(null);
    
    try {
      // Önce tüm kullanıcıları çek
      const kullanicilarRes = await fetch(`http://localhost:5000/api/kullanicilar/${profilId}`);
      const kullanicilar = await kullanicilarRes.json();
      setListOwner(kullanicilar);
      
      // Takip ilişkilerini çek
      const takipRes = await fetch(`http://localhost:5000/api/takipler/${profilId}`);
      const {takipler,takipciler} = await takipRes.json();
      setTakipciler(takipciler);
      setTakipEdilenler(takipler);
      
    } catch (err) {
      console.error('Veri çekme hatası:', err);
      setError('Veriler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleTakibiBirak = async (kullaniciId) => {
    if (!currentUser) return;
    
    try {
      const response = await fetch('http://localhost:5000/api/takibi-birak', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          takipEden_id: currentUser.id,
          takipEdilen_id: kullaniciId
        })
      });
      
      if (response.ok) {
        // Listeyi güncelle
        setTakipEdilenler(prev => prev.filter(u => u.id !== kullaniciId));
        alert('Takip bırakıldı.');
      } else {
        const error = await response.json();
        alert(error.message || 'Takibi bırakırken bir hata oluştu.');
      }
    } catch (err) {
      console.error('Takibi bırakma hatası:', err);
      alert('İşlem sırasında bir hata oluştu.');
    }
  };
  
  const handleTakiptenCikar = async (kullaniciId) => {
    if (!currentUser) return;
    
    try {
      const response = await fetch('http://localhost:5000/api/takipci-cikar', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          takipEden_id: kullaniciId,
          takipEdilen_id: currentUser.id
        })
      });
      
      if (response.ok) {
        // Listeyi güncelle
        setTakipciler(prev => prev.filter(u => u.id !== kullaniciId));
        alert('Takipçi çıkarıldı.');
      } else {
        const error = await response.json();
        alert(error.message || 'Takipçiyi çıkarırken bir hata oluştu.');
      }
    } catch (err) {
      console.error('Takipçi çıkarma hatası:', err);
      alert('İşlem sırasında bir hata oluştu.');
    }
  };

  const renderUserList = (kullanicilar, type) => {
    if (kullanicilar.length === 0) {
      return <p className="text-muted">Burada gösterilecek kimse yok.</p>;
    }
    
    return kullanicilar.map(user => (
      <div key={user.id} className="d-flex justify-content-between align-items-center p-3 mb-2 bg-light rounded">
        <div>
          {currentUser && currentUser.id === user.id ? (
             <Link to={`/profilim`} className="fw-bold text-decoration-none">
               @{user.username}
             </Link>
          ) : (
             <Link to={`/profil/${user.id}`} className="fw-bold text-decoration-none">
               @{user.username}
             </Link>
          )}
          <p className="mb-0 text-muted">{user.name} {user.surname}</p>
        </div>
        
        {/* Butonlar sadece benim listem ise görünür */}
        {isMyList && type === 'takipEdilenler' && (
          <button 
            className="btn btn-danger btn-sm" 
            onClick={() => handleTakibiBirak(user.id)}
          >
            Takibi Bırak
          </button>
        )}
        {isMyList && type === 'takipciler' && (
          <button 
            className="btn btn-danger btn-sm" 
            onClick={() => handleTakiptenCikar(user.id)}
          >
            Takipten Çıkar
          </button>
        )}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="container my-5 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container my-5">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!listOwner) {
    return (
      <div className="container my-5 text-center">
        <h2>Kullanıcı bulunamadı.</h2>
      </div>
    );
  }

  return (
    <div className="container my-5">
      <h3 className='mb-4'>@{listOwner.username} Takip Listesi</h3>
      
      <ul className="nav nav-tabs nav-fill mb-4">
        <li className="nav-item">
          <a 
            className={`nav-link ${aktifSekme === 'takipciler' ? 'active' : ''}`} 
            style={{ cursor: 'pointer' }} 
            onClick={() => setAktifSekme('takipciler')}
          >
            Takipçiler ({takipciler.length})
          </a>
        </li>
        <li className="nav-item">
          <a 
            className={`nav-link ${aktifSekme === 'takipEdilenler' ? 'active' : ''}`} 
            style={{ cursor: 'pointer' }} 
            onClick={() => setAktifSekme('takipEdilenler')}
          >
            Takip Edilenler ({takipEdilenler.length})
          </a>
        </li>
      </ul>

      <div>
        {aktifSekme === 'takipciler' && renderUserList(takipciler, 'takipciler')}
        {aktifSekme === 'takipEdilenler' && renderUserList(takipEdilenler, 'takipEdilenler')}
      </div>
    </div>
  );
}

export default TakipListesi;