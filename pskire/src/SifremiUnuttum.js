import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import './css/SifremiUnuttum.css'; // Oluşturduğumuz CSS dosyasını import ediyoruz

const SifremiUnuttum = () => {
    const [step, setStep] = useState(1); // 1: Email gir, 2: Kodu ve yeni şifreyi gir
    const [email, setEmail] = useState('');
    const [kod, setKod] = useState('');
    const [yeniSifre, setYeniSifre] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(180);
    const [resendActive, setResendActive] = useState(false);

    const navigate = useNavigate();

    // Geri sayım sayacı için useEffect
    useEffect(() => {
        let interval;
        if (step === 2 && timer > 0) {
            interval = setInterval(() => {
                setTimer((prevTimer) => prevTimer - 1);
            }, 1000);
        } else if (timer === 0) {
            setResendActive(true);
            clearInterval(interval);
        }
        return () => clearInterval(interval); // Component'ten ayrılınca interval'ı temizle
    }, [step, timer]);

    // E-posta gönderimini yöneten fonksiyon
    const handleEmailSubmit = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            // API adresinizi buraya yazın
            const response = await axios.post('/api/sifre-sifirla/istek', { email });
            setMessage(response.data.message);
            setStep(2); // Sonraki adıma geç
            setTimer(180); // Sayacı yeniden başlat
            setResendActive(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    // Şifre sıfırlamayı yöneten fonksiyon
    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await axios.post('/api/sifre-sifirla/onayla', { email, kod, yeniSifre });
            setMessage(response.data.message + " Giriş sayfasına yönlendiriliyorsunuz...");
            
            // 3 saniye sonra giriş sayfasına yönlendir
            setTimeout(() => {
                navigate('/login');
            }, 3000);

        } catch (err) {
            setError(err.response?.data?.message || 'Şifre sıfırlanamadı. Kodu veya bilgilerinizi kontrol edin.');
        } finally {
            setLoading(false);
        }
    };

    // Zamanı MM:SS formatında göstermek için
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="forgot-password-container">
            <Card className="forgot-password-card">
                <Card.Body>
                    <Card.Title>Şifremi Unuttum</Card.Title>
                    
                    {/* Hata ve Başarı Mesajları */}
                    {error && <Alert variant="danger">{error}</Alert>}
                    {message && <Alert variant="success">{message}</Alert>}

                    {step === 1 ? (
                        // ADIM 1: E-posta Formu
                        <Form onSubmit={handleEmailSubmit}>
                            <p className="text-muted text-center mb-4">
                                Hesabınıza ait e-posta adresini girerek şifre sıfırlama kodunu alabilirsiniz.
                            </p>
                            <Form.Group className="mb-3" controlId="formBasicEmail">
                                <Form.Label>E-posta Adresi</Form.Label>
                                <Form.Control
                                    type="email"
                                    placeholder="ornek@mail.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </Form.Group>
                            <Button variant="primary" type="submit" className="btn-submit" disabled={loading}>
                                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Sıfırlama Kodu Gönder'}
                            </Button>
                        </Form>
                    ) : (
                        // ADIM 2: Kod ve Yeni Şifre Formu
                        <Form onSubmit={handleResetSubmit}>
                            <p className="text-muted text-center mb-4">
                                <strong>{email}</strong> adresine gönderilen 6 haneli kodu ve yeni şifrenizi girin.
                            </p>
                            <Form.Group className="mb-3" controlId="formBasicCode">
                                <Form.Label>Doğrulama Kodu</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="123456"
                                    value={kod}
                                    onChange={(e) => setKod(e.target.value)}
                                    required
                                    maxLength="6"
                                />
                            </Form.Group>
                            <Form.Group className="mb-3" controlId="formBasicPassword">
                                <Form.Label>Yeni Şifre</Form.Label>
                                <Form.Control
                                    type="password"
                                    placeholder="Yeni şifrenizi girin"
                                    value={yeniSifre}
                                    onChange={(e) => setYeniSifre(e.target.value)}
                                    required
                                />
                            </Form.Group>
                            <Button variant="primary" type="submit" className="btn-submit" disabled={loading}>
                                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Şifreyi Sıfırla'}
                            </Button>

                            <div className="timer-container">
                                {timer > 0 ? (
                                    <p className="timer-text">
                                        Yeni kod istemek için: <span>{formatTime(timer)}</span>
                                    </p>
                                ) : (
                                    <a
                                        className={`resend-link ${!resendActive || loading ? 'disabled' : ''}`}
                                        onClick={!loading && resendActive ? handleEmailSubmit : null}
                                    >
                                        Yeniden Gönder
                                    </a>
                                )}
                            </div>
                        </Form>
                    )}
                </Card.Body>
            </Card>
        </div>
    );
};

export default SifremiUnuttum;