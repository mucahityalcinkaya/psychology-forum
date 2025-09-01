import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Swal from 'sweetalert2';
import { GoogleLogin } from "@react-oauth/google";
import './css/Login.css';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const navigate = useNavigate();
    const { login } = useAuth();

    // YENİ: Hem normal hem de Google girişi için ortak sonuç işleme fonksiyonu
    const handleLoginResult = async (result) => {
        if (result.success) {
            // Başarılı giriş sonrası yeni uyarıları kontrol et
            const yeniUyarilar = result.data.yeniUyarilar;
            if (yeniUyarilar && yeniUyarilar.length > 0) {
                const uyariHtml = yeniUyarilar.map(uyari => 
                    `<div style="text-align: left; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                        <p><strong>Sebep:</strong> ${uyari.sebep}</p>
                        <small><strong>Tarih:</strong> ${new Date(uyari.tarih).toLocaleString('tr-TR')}</small>
                    </div>`
                ).join('');

                await Swal.fire({
                    icon: 'warning',
                    title: `Okunmamış ${yeniUyarilar.length} Uyarınız Var!`,
                    html: `<div style="max-height: 200px; overflow-y: auto;">${uyariHtml}</div>`,
                    confirmButtonText: 'Anladım'
                });
            }
            navigate('/'); // Uyarı gösterildikten sonra ana sayfaya yönlendir
        } else {
            // Başarısız giriş durumunda ban kontrolü yap
            if (result.data && result.data.banInfo) {
                Swal.fire({
                    icon: 'error',
                    title: 'Hesabınız Askıya Alınmış',
                    html: `
                        <div style="text-align: left; padding: 0 1rem;">
                            <p><strong>Sebep:</strong> ${result.data.banInfo.sebep}</p>
                            <hr/>
                            <p><strong>Ban Tarihi:</strong> ${new Date(result.data.banInfo.tarih).toLocaleDateString('tr-TR')}</p>
                        </div>
                    `,
                    confirmButtonText: 'Haksız Ban Bildirimi',
                    showCancelButton: true,
                    cancelButtonText: 'Anladım',
                    footer: '<small>Butona tıklayarak yetkililerle iletişime geçebilirsiniz.</small>'
                }).then((swalResult) => {
                    if (swalResult.isConfirmed) {
                        navigate('/banli-panel');
                    }
                });
            } else {
                // Diğer tüm hataları formda göster
                setError(result.data.message);
            }
        }
    };

    // GÜNCELLENDİ: Normal e-posta/şifre girişi
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        // AuthContext'teki login fonksiyonunu e-posta ve şifre ile çağır
        const result = await login({ email, password });
        // Gelen sonucu ortak fonksiyona göndererek işlemi tamamla
        await handleLoginResult(result);
        setLoading(false);
    };

    // GÜNCELLENDİ: Google ile giriş
    const handleGoogleLoginSuccess = async (credentialResponse) => {
        setError('');
        setLoading(true);
        // AuthContext'teki login fonksiyonunu bu sefer Google token'ı ile çağır
        const result = await login({ googleToken: credentialResponse.credential });
        // Gelen sonucu ortak fonksiyona göndererek işlemi tamamla
        await handleLoginResult(result);
        setLoading(false);
    };
    
    const handleGoogleLoginError = () => {
        setLoading(false);
        Swal.fire('Hata!', 'Google ile giriş sırasında bir sorun oluştu.', 'error');
    };

    return (
        <div className="login-page-container">
            <div className="login-card">
                <div className="card-body">
                    <div className="text-center mb-4">
                        <i className="fas fa-user-circle login-icon"></i>
                        <h3>Oturum Aç</h3>
                    </div>
                    
                    <form onSubmit={handleLogin}>
                        {error && <div className="alert alert-danger custom-error">{error}</div>}
                        
                        <div className="mb-3">
                            <label htmlFor="email" className="form-label">E-posta Adresi</label>
                            <div className="input-group-custom">
                                <i className="fas fa-envelope input-icon"></i>
                                <input 
                                    type="email" 
                                    className="form-control" 
                                    id="email" 
                                    placeholder="E-posta adresiniz"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label htmlFor="password" className="form-label">Şifre</label>
                            <div className="input-group-custom">
                                <i className="fas fa-lock input-icon"></i>
                                <input 
                                    type="password" 
                                    className="form-control" 
                                    id="password" 
                                    placeholder="Şifreniz"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="d-flex justify-content-between align-items-center mb-4 other-links">
                            <Link to="/register">Yeni Hesap Oluştur</Link>
                            <Link to="/sifremiunuttum">Şİfremi Unuttum</Link>
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-login w-100"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Giriş yapılıyor...
                                </>
                            ) : (
                                'Giriş Yap'
                            )}
                        </button>
                    </form>

                    <div className="text-center my-3 position-relative">
                        <hr />
                        <span className="or-separator px-2 bg-white">VEYA</span>
                    </div>

                    {/* GÜNCELLENDİ: GoogleLogin butonu artık handleGoogleLoginSuccess'ı çağırıyor */}
                    <div className="d-flex justify-content-center" >
                         <GoogleLogin
                            onSuccess={handleGoogleLoginSuccess}
                            onError={handleGoogleLoginError}
                            useOneTap
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;