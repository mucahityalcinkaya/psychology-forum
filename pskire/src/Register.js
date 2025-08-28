// DOSYA: src/pages/Register.js

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import Swal from 'sweetalert2';
import './css/Register.css';

function Register() {
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        username: '',
        password: '',
        gender: '',
        birthdate: '',
        email: '',
    });
    const [isGoogleRegister, setIsGoogleRegister] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({ ...prevState, [name]: value }));
    };

    const handleGoogleSuccess = async (tokenResponse) => {
        try {
            const response = await fetch('http://localhost:5000/api/google-register-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: tokenResponse.access_token }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            
            // DEĞİŞİKLİK 1: 'gender' alanı artık API'den gelmiyor, bu yüzden formda boş kalacak.
            setFormData({
                ...formData,
                name: data.name,
                surname: data.surname,
                email: data.email,
                gender: '', // Cinsiyet alanını boş başlatıyoruz.
                birthdate: data.birthdate || '',
            });
            setIsGoogleRegister(true);
            Swal.fire('Bilgileriniz Alındı', 'Lütfen eksik alanları doldurarak kaydınızı tamamlayın.', 'info');
            
        } catch (error) {
            Swal.fire('Hata!', error.message, 'error');
        }
    };
    
    // DEĞİŞİKLİK 2: 'scope' listesinden 'user.gender.read' kaldırıldı.
    const googleLogin = useGoogleLogin({
        onSuccess: handleGoogleSuccess,
        scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/user.birthday.read'].join(' '),
    });
    
    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:5000/api/kayitol', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            
            Swal.fire('Kayıt Başarılı!', 'Kaydınız başarıyla tamamlandı. Lütfen giriş yapınız.', 'success');
            navigate('/login');
        } catch (error) {
            Swal.fire('Kayıt Hatası!', error.message, 'error');
        }
    };

    return (
        <div className="register-page-container min-vh-100 d-flex align-items-center justify-content-center">
            <div className="card shadow-sm w-100" style={{ maxWidth: '500px' }}>
                <div className="card-body p-4">
                    <h3 className="card-title text-center mb-4">Kayıt Ol</h3>
                    
                    {isGoogleRegister && (
                        <div className="alert alert-info">
                            <strong>{formData.email}</strong> ile Google üzerinden kayıt oluyorsunuz. Lütfen eksik alanları tamamlayın.
                        </div>
                    )}
                    
                    <form onSubmit={handleRegister}>
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label>Ad</label>
                                <input type="text" className="form-control" name="name" value={formData.name} onChange={handleChange} required disabled={isGoogleRegister} />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label>Soyad</label>
                                <input type="text" className="form-control" name="surname" value={formData.surname} onChange={handleChange} required disabled={isGoogleRegister} />
                            </div>
                        </div>
                        
                         <div className="mb-3">
                            <label>E-posta Adresi</label>
                            <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} required disabled={isGoogleRegister} />
                        </div>
                        
                        {/* DEĞİŞİKLİK 3: 'isGoogleRegister' durumunda Doğum Tarihi alanı disabled kalacak, Cinsiyet alanı ise aktif ve seçilebilir olacak. */}
                        <div className="row">
                             <div className="col-md-6 mb-3">
                                <label>Cinsiyet</label>
                                <select className="form-select" name="gender" value={formData.gender} onChange={handleChange} required>
                                    <option value="">Lütfen Seçiniz</option>
                                    <option value="erkek">Erkek</option>
                                    <option value="kadin">Kadın</option>
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label>Doğum Tarihi</label>
                                <input type="date" className="form-control" name="birthdate" value={formData.birthdate} onChange={handleChange} required disabled={isGoogleRegister} />
                            </div>
                        </div>
                        
                        <div className="mb-3">
                            <label>Kullanıcı Adı</label>
                            <input type="text" className="form-control" name="username" placeholder="Kullanıcı adınızı girin" value={formData.username} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label>Şifre</label>
                            <input type="password" className="form-control" name="password" placeholder="Şifrenizi oluşturun" value={formData.password} onChange={handleChange} required />
                        </div>

                        <button type="submit" className="btn btn-outline-success w-100">Kayıt ol</button>
                    </form>

                     <div className="text-center my-3 position-relative">
                        <hr /> <span className="or-separator px-2 bg-white">VEYA</span> <hr />
                    </div>

                    <button onClick={() => googleLogin()} className="btn btn-outline-dark w-100">
                        <i className="bi bi-google me-2"></i> Google ile Kayıt Ol
                    </button>
                    
                    <div className="text-end mt-3">
                        <small><Link to="/login">Zaten üye misiniz? Giriş Yapın</Link></small>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Register;