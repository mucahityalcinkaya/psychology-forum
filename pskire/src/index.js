// Önce Stil Dosyaları
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './index.css'; // Kendi özel stillerin
import { GoogleOAuthProvider } from '@react-oauth/google'
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';

// !! SORUNU ÇÖZECEK OLAN EKSİK SATIR !!
// Bootstrap'in tüm interaktif özelliklerini (dropdown, modal, vs.) çalıştırır.
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import App from './App';
import reportWebVitals from './reportWebVitals';


const CLIENT_ID ="419068256229-ksu2h8nlu17gb2c72gb7gm3sjnj6oi34.apps.googleusercontent.com"
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={CLIENT_ID}>
    <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();