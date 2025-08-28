import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './css/Ara.css';

function Ara() {
  const { currentUser } = useAuth();
  const [aramaTerimi, setAramaTerimi] = useState('');
  const [sonuclar, setSonuclar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    if (!aramaTerimi.trim()) {
      setSonuclar([]);
      setHata(null);
      setLoading(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      const fetchSonuclar = async () => {
        setLoading(true);
        setHata(null);

        try {
          const response = await fetch(`http://localhost:5000/api/kullaniciara?q=${encodeURIComponent(aramaTerimi)}`);
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Kullanıcı araması sırasında hata oluştu.');
          }

          setSonuclar(data);
        } catch (err) {
          console.error("Arama hatası:", err);
          setHata(err.message);
          setSonuclar([]);
        } finally {
          setLoading(false);
        }
      };

      fetchSonuclar();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [aramaTerimi]);

  const getProfilPath = (targetUserId) => {
    if (currentUser && currentUser.id === targetUserId) {
      return '/profilim';
    }
    return `/profil/${targetUserId}`;
  };

  return (
    <div className="ara-page-container container my-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <h1 className="h2 text-center mb-4">Toplulukta Kullanıcı Ara</h1>
          <div className="input-group input-group-lg shadow-sm mb-4">
            <span className="input-group-text bg-light border-0">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="search"
              className="form-control border-0"
              placeholder="Ad, soyad veya kullanıcı adı..."
              value={aramaTerimi}
              onChange={e => setAramaTerimi(e.target.value)}
              autoFocus
            />
          </div>

          <div className="list-group">
            {loading && (
              <div className="list-group-item text-center">
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Aranıyor...</span>
                </div>
              </div>
            )}

            {hata && (
              <div className="alert alert-danger text-center">{hata}</div>
            )}

            {!loading && !hata && aramaTerimi.trim() && sonuclar.length === 0 && (
              <div className="alert alert-warning text-center">
                Aradığınız kriterlere uygun bir kullanıcı bulunamadı.
              </div>
            )}

            {!loading && !hata && sonuclar.map(kullanici => (
              <Link
                key={kullanici.id}
                to={getProfilPath(kullanici.id)}
                className="list-group-item list-group-item-action d-flex align-items-center"
              >
                <i className="bi bi-person-circle fs-3 me-3 text-secondary"></i>
                <div>
                  <div className="fw-bold">{kullanici.name} {kullanici.surname}</div>
                  <div className="text-muted">@{kullanici.username}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Ara;
