import React, { createContext, useState, useContext, useEffect } from 'react';
import Swal from 'sweetalert2';

const AuthContext = createContext(null);

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem('currentUser');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (error) {
            console.error("localStorage'dan kullanıcı verisi alınamadı", error);
            return null;
        }
    });

    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            localStorage.removeItem('currentUser');
        }
    }, [currentUser]);

    useEffect(() => {
        const yeniUyarilariKontrolEt = async () => {
            if (!currentUser || currentUser.isBanned) return;

            // Düzeltme: userId'yi sorguya göndermeden önce bir sayıya çeviriyoruz.
            const userId = parseInt(currentUser.id, 10);
            if (isNaN(userId)) {
                console.error("Geçersiz kullanıcı ID'si:", currentUser.id);
                return; // Geçersizse devam etme
            }

            try {
                // Fetch isteğinde düzeltilmiş userId'yi kullanıyoruz.
                const response = await fetch(`http://localhost:5000/api/kullanici/yeni-uyarilar?userId=${userId}`);
                const yeniUyarilar = await response.json();
                
                // ... (Geri kalan kod aynı)
                
                // Görüntülenen uyarıları "okundu" olarak işaretle
                const goruntulenenUyariIds = yeniUyarilar.map(uyari => uyari.id);
                await fetch('http://localhost:5000/api/kullanici/uyarilari-okundu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        userId: userId, // Düzeltilmiş userId'yi kullanıyoruz
                        uyariIds: goruntulenenUyariIds 
                    })
                });
            } catch (error) {
                console.error('Yeni uyarılar kontrol edilirken hata:', error);
            }
        };

        yeniUyarilariKontrolEt();
    }, [currentUser]);

    const login = async (credentials) => {
        try {
            let endpoint = 'http://localhost:5000/api/login';
            let body = {};

            if (credentials.googleToken) {
                endpoint = 'http://localhost:5000/api/login/google';
                body = { token: credentials.googleToken };
            } else {
                body = { email: credentials.email, password: credentials.password };
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json();

            if (response.ok) {
                // Başarılı giriş
                setCurrentUser(data);
                return { success: true, data: data };
            } else {
                if (response.status === 403 && data.banInfo) {
                    // DÜZELTME: Banlı kullanıcı için isBanned bayrağını ekle
                    const bannedUser = { ...data.user, isBanned: true, banInfo: data.banInfo };
                    setCurrentUser(bannedUser);
                    return { success: false, data: { banInfo: data.banInfo, user: bannedUser, message: data.message } };
                }
                // Diğer tüm hatalar
                return { success: false, data: data };
            }
        } catch (error) {
            console.error('Login API isteği sırasında hata:', error);
            return { success: false, data: { message: 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.' } };
        }
    };
    
    const logout = () => {
        setCurrentUser(null);
    };
    
    const updateUser = (newUserData) => {
        setCurrentUser(prevUser => ({
            ...prevUser,
            ...newUserData
        }));
    };

    const value = {
        currentUser,
        login,
        logout,
        updateUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}