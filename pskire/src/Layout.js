import React, { useState, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import './css/Main.css'; 
import logo from './assets/logo.png';
import { useAuth } from './context/AuthContext';


// Layout bileşeni, uygulamanın ana çerçevesini (şablonunu) oluşturur.
function Layout() {
  const { currentUser } = useAuth();
  const [hastaliklar, sethastaliklar] = useState([]);
  // --- STATE MANAGEMENT ---
  const [isSidebarActive, setSidebarActive] = useState(false);
  const [isHastaliklarOpen, setHastaliklarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false); // Scroll efekti için


useEffect(() => {        
        fetch('http://localhost:5000/api/hastaliklar')
            .then(response => response.json()) // Response'un body'sindeki JSON'u JavaScript objesine çevir
            .then(data => {
                sethastaliklar(data); // Gelen veriyi hastalıklar state'ine kaydet
            })
        
            .catch(error => {
                console.error("API'dan test verisi çekerken hata oluştu:", error);
            });
            
    }, [])

  // --- SCROLL EFFECT ---
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- HANDLER FUNCTIONS ---
  const toggleSidebar = () => setSidebarActive(!isSidebarActive);
  const toggleHastaliklarDropdown = () => setHastaliklarOpen(!isHastaliklarOpen);
  const closeDropdown = () => setHastaliklarOpen(false);

  // --- RENDER FUNCTIONS / SUB-COMPONENTS ---
  
  const SidebarNav = () => (
    <nav id="sidebar" className={`sidebar bg-dark ${isSidebarActive ? 'active' : ''}`}>
      <div className="position-sticky">
        <ul className="nav flex-column p-3">
          {/* Ana Sayfa Linki */}
          <li className="nav-item mb-2">
            <Link className="nav-link text-white" to="/">
              <i className="bi-house-door-fill me-2"></i> Ana Sayfa
            </Link>
          </li>
          
          {/* Hastalıklar Dropdown Menüsü */}
          <li className="nav-item mb-2 dropdown">
            <a 
              className="nav-link text-white dropdown-toggle" 
              href="#" 
              role="button" 
              onClick={(e) => { 
                e.preventDefault(); 
                toggleHastaliklarDropdown(); 
              }}
            >
              <i className="bi-card-list me-2"></i> Hastalıklar
            </a>
            <ul className={`dropdown-menu dropdown-menu-dark ${isHastaliklarOpen ? 'show' : ''}`}>
              {hastaliklar.map((hastalik) => (
                <li key={hastalik.id}>
                  <Link 
                    className="dropdown-item" 
                    to={`/hastaliklar/${hastalik.slug}`}
                    onClick={closeDropdown}
                  >
                    {hastalik.illness_name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>

            <li className="nav-item mb-2">
              <Link className="nav-link text-white" to="/ara">
                <i className="bi bi-search me-2"></i> Arama yap
              </Link>
            </li>
            <li className="nav-item mb-2">
              <Link className="nav-link text-white" to="/sorular">
                <i className="bi bi-question-circle me-2"></i> Sorular
              </Link>
            </li>
            <li className="nav-item mb-2">
              <Link className="nav-link text-white" to="/tartismalar">
                <i className="bi bi-chat-dots me-2"></i> Tartışma
              </Link>
            </li>
            <li className="nav-item mb-2">
              <Link className="nav-link text-white" to="/testler">
                <i className="bi bi-clipboard-check me-2"></i> Testler
              </Link>
            </li>
            <li className="nav-item mb-2">
              <Link className="nav-link text-white" to="/ruh-halim">
                <i className="bi bi-emoji-smile me-2"></i> Ruh Halim
              </Link>
            </li>
            <li className="nav-item mb-2">
              {currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'moderator') && (
                <Link to="/admin-paneli" className="nav-link text-white">
                  <i className="bi bi-shield-lock me-2"></i> Yönetim Paneli
                </Link>
              )}
            </li>
            <li className="nav-item mb-2">
              <Link className="nav-link text-white" to="/iletisim">
                <i className="bi bi-question-circle me-2"></i> İletişim
              </Link>
            </li>


        </ul>
      </div>
    </nav>
  );

  const HeaderNav = () => {
    const { currentUser } = useAuth();

    return (
      <header className={`navbar navbar-dark sticky-top bg-dark flex-md-nowrap shadow ${scrolled ? 'scrolled' : ''}`}>
        <div className="d-flex align-items-center">
          <button onClick={toggleSidebar} className="navbar-toggler navbar-toggler-white d-none d-md-block ms-2" type="button">
            <i className="bi bi-list fs-4"></i>
          </button>
          <button onClick={toggleSidebar} className="navbar-toggler navbar-toggler-white d-md-none collapsed" type="button">
            <span className="navbar-toggler-icon"></span>
          </button>
        </div>
        <div className="navbar-brand px-3 fs-4 mx-auto">Psikoblog</div>
        <div className="navbar-nav">
          <Link to="/profilim" className="p-1 bg-white rounded-circle " style={{ textDecoration: 'none' }}>
          <div className="nav-item text-nowrap d-flex align-items-center me-3">
            <div className="text-end text-white me-3">
              {currentUser ? (
                <div className="fw-bold">{currentUser.name} {currentUser.surname}</div>
              ) : (
                <div className="fw-bold">Giriş Yapılmadı</div>
              )}
              <small>Hoş Geldiniz</small>
            </div>
            
              <img src={logo} alt="Logo" width="40" height="40" />
            
          </div>
          </Link>
        </div>
      </header>
    );
  };

  // --- MAIN RENDER ---
  return (
    <>
      <SidebarNav />
      <div id="mainContent" className={`main-content ${isSidebarActive ? 'sidebar-active' : ''}`}>
        <HeaderNav />
        <main className="container-fluid main-content-area">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default Layout;