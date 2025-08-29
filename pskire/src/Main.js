import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './css/ana.css';

function Main() {
  const { currentUser } = useAuth();
  const [feedData, setFeedData] = useState({
    paylasimlar: [],
    sorular: [],
    kullanicilar: [],
    paylasimIlac: [],
    paylasimYanetki: [],
    takipSayisi: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const fetchFeedData = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/main/${currentUser.id}`);
      
      if (!response.ok) {
        throw new Error('Veri alınamadı');
      }
      
      const data = await response.json();
      
      const takipResponse = await fetch(`/api/kullanicilar/${currentUser.id}/takip-sayilari`);
      const takipData = await takipResponse.json();
      
      setFeedData({
        paylasimlar: data.paylasimlar || [],
        sorular: data.sorular || [],
        kullanicilar: data.kullanicilar || [],
        paylasimIlac: data.paylasimIlac || [],
        paylasimYanetki: data.paylasimYanetki || [],
        takipSayisi: takipData.takipEdilenSayisi || 0
      });
      
    } catch (error) {
      console.error('Feed verisi alınırken hata:', error);
      setFeedData({
        paylasimlar: [],
        sorular: [],
        kullanicilar: [],
        paylasimIlac: [],
        paylasimYanetki: [],
        takipSayisi: 0
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && currentUser.id) {
      fetchFeedData();
    } else {
      setLoading(false);
    }
  }, [currentUser, fetchFeedData]);

  const getUserInfoById = (userId) => {
    const user = feedData.kullanicilar?.find(u => u.id === userId);
    return user || { name: 'Bilinmeyen', surname: '', username: 'bilinmeyen' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('tr-TR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMedicineInfo = (paylasimId) => {
    return feedData.paylasimIlac?.filter(pi => pi.paylasim_id === paylasimId) || [];
  };

  const getSideEffectInfo = (paylasimId) => {
    return feedData.paylasimYanetki?.filter(py => py.paylasim_id === paylasimId) || [];
  };

  const allPostsAndQuestions = [...feedData.paylasimlar, ...feedData.sorular].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredItems = filterType === 'all' 
    ? allPostsAndQuestions
    : filterType === 'paylasim' 
      ? feedData.paylasimlar.sort((a, b) => new Date(b.date) - new Date(a.date))
      : feedData.sorular.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (loading) {
    return (
      <div className="container my-5">
        <div className="text-center">
          <div className="spinner-border spinner-border-lg text-primary" role="status">
            <span className="visually-hidden">Yükleniyor...</span>
          </div>
          <h4 className="mt-3 text-muted">Akış Yükleniyor...</h4>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container my-5">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card border-0 shadow-lg welcome-card">
              <div className="card-body p-5 text-center">
                <div className="mb-4">
                  <i className="bi bi-heart-pulse-fill text-primary" style={{fontSize: '4rem'}}></i>
                </div>
                <h1 className="display-5 fw-bold mb-3">Psikoblog'a Hoş Geldiniz</h1>
                <p className="lead text-muted mb-4">
                  Binlerce kullanıcının deneyimlerini keşfedin, kendi hikayenizi paylaşın ve 
                  destekleyici bir toplulukla bağlantı kurun.
                </p>
                <div className="d-flex gap-3 justify-content-center">
                  <Link to="/login" className="btn btn-primary btn-lg px-5 py-3 rounded-pill shadow-sm">
                    <i className="bi bi-box-arrow-in-right me-2"></i>Giriş Yap
                  </Link>
                  <Link to="/" className="btn btn-outline-primary btn-lg px-5 py-3 rounded-pill">
                    <i className="bi bi-person-plus me-2"></i>Kayıt Ol
                  </Link>
                </div>
                <div className="welcome-stats mt-5">
                  <div className="row text-center">
                    <div className="col-4">
                      <h3 className="text-primary mb-0">10K+</h3>
                      <small className="text-muted">Kullanıcı</small>
                    </div>
                    <div className="col-4">
                      <h3 className="text-primary mb-0">50K+</h3>
                      <small className="text-muted">Paylaşım</small>
                    </div>
                    <div className="col-4">
                      <h3 className="text-primary mb-0">100K+</h3>
                      <small className="text-muted">Etkileşim</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='container my-4'>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm rounded-4 header-card text-white">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h1 className="h2 mb-0 fw-bold">
                    <i className="bi bi-rss-fill me-2"></i>Ana Akış
                  </h1>
                  <p className="mb-0 mt-2 opacity-75">
                    Takip ettiğiniz {feedData.takipSayisi} kişinin güncel paylaşımları ve soruları
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12">
          <div className="btn-group w-100 shadow-sm" role="group">
            <button 
              className={`btn btn-lg ${filterType === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setFilterType('all')}
            >
              <i className="bi bi-grid-3x3-gap me-2"></i>
              Tümü ({allPostsAndQuestions.length})
            </button>
            <button 
              className={`btn btn-lg ${filterType === 'paylasim' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setFilterType('paylasim')}
            >
              <i className="bi bi-journal-text me-2"></i>
              Paylaşımlar ({feedData.paylasimlar.length})
            </button>
            <button 
              className={`btn btn-lg ${filterType === 'soru' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setFilterType('soru')}
            >
              <i className="bi bi-patch-question-fill me-2"></i>
              Sorular ({feedData.sorular.length})
            </button>
          </div>
        </div>
      </div>
      
      {filteredItems.length > 0 ? (
        <div className="row g-4">
          {filteredItems.map((item, index) => {
            const itemType = item.type;
            const user = getUserInfoById(item.user_id);
            const medicines = getMedicineInfo(item.id);
            const sideEffects = getSideEffectInfo(item.id);
            
            return (
              <div key={item.id} className="col-12" style={{animationDelay: `${index * 0.05}s`}}>
                <Link 
                  to={itemType === 'paylasim' ? `/PaylasimDetay/${item.id}` : `/sorular/${item.id}`}
                  className="text-decoration-none"
                >
                  <div className="card border-0 shadow-sm rounded-3 h-100 feed-card">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center">
                          <div className="avatar-circle bg-success text-white me-3">
                            {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <h6 className="mb-0 text-dark fw-semibold">
                              {user.name} {user.surname}
                            </h6>
                            <small className="text-muted">
                              <i className="bi bi-clock me-1"></i>
                              {formatDate(item.date)}
                            </small>
                          </div>
                        </div>
                        <span className={`badge rounded-pill px-3 py-2 ${itemType === 'paylasim' ? 'bg-success bg-opacity-10 text-success' : 'bg-info bg-opacity-10 text-info'} border border-opacity-25`}>
                          <i className={`bi ${itemType === 'paylasim' ? 'bi-journal-text' : 'bi-patch-question-fill'} me-1`}></i>
                          {itemType === 'paylasim' ? 'Paylaşım' : 'Soru'}
                        </span>
                      </div>

                      <h5 className="card-title text-dark mb-2 fw-bold">
                        {item.title}
                      </h5>

                      {item.content && (
                        <p className="card-text text-muted mb-3">
                          {item.content.substring(0, 150)}
                          {item.content.length > 150 && '...'}
                        </p>
                      )}
                      
                      {itemType === 'paylasim' && (
                        <div className="mb-3">
                          {medicines.length > 0 && (
                            <div className="mb-2">
                                <small className="text-muted">
                                    <i className="bi bi-capsule me-1"></i>
                                    İlaçlar: {medicines.map(m => m.medicine_name).join(', ')}
                                </small>
                            </div>
                          )}
                          {sideEffects.length > 0 && (
                            <div>
                                <small className="text-muted">
                                    <i className="bi bi-exclamation-triangle me-1"></i>
                                    Yan Etkiler: {sideEffects.map(s => s.sideeffects_name).join(', ')}
                                </small>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                        <span className="text-primary small fw-semibold">
                          Devamını Oku <i className="bi bi-arrow-right"></i>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="row">
          <div className="col-12">
            <div className="card border-0 shadow-sm empty-feed-card">
              <div className="card-body p-5 text-center">
                <i className="bi bi-inbox empty-feed-icon text-muted mb-3" style={{fontSize: '5rem'}}></i>
                <h3 className="mb-3">Akışınız Henüz Boş</h3>
                <p className="text-muted mb-4">
                  Takip ettiğiniz kişiler henüz bir paylaşım veya soru yapmamış.
                </p>
                <div className="d-flex gap-3 justify-content-center">
                  <Link to="/ara" className="btn btn-primary btn-lg rounded-pill px-4">
                    <i className="bi bi-search me-2"></i>
                    Kullanıcıları Keşfet
                  </Link>
                  <Link to="/hastaliklar" className="btn btn-outline-primary btn-lg rounded-pill px-4">
                    <i className="bi bi-compass me-2"></i>
                    Hastalıkları İncele
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Main;