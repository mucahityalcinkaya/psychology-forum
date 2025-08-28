import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; 

// Sayfalar ve Layout
import Layout from './Layout';
import Register from './Register';
import Login from './Login';
import Main from './Main';
import HastalikDetay from './HastalikDetay'; 
import SoruListesi from './SoruListesi';
import SoruDetay from './SoruDetay';
import SoruSor from './SoruSor';
import YeniPaylasim from './YeniPaylasim';
import Profil from './Profil';
import ProfilDuzenle from './ProfilDuzenle';
import SifreDegistir from './SifreDegistir';
import KullaniciProfil from './KullaniciProfil';
import TakipListesi from './TakipListesi';
import Ara from './Ara';
import PaylasimDetay from './PaylasimDetay';
import TartismaDetay from './TartismaDetay';
import TartismaListesi from './TartismalarListesi';
import YorumKarti from './YorumKarti';
import TestListesi from './TestListesi';
import TestDetay from './TestDetay';
import GunlukPuanlama from './GunlukPuanlama';
import AdminPaneli from './AdminPaneli';
import AdminRoute from './AdminRoute';
import TartismaEkle from './TartismaEkle';
import Iletisim from './Iletisim'; // Yeni component'i import et
import TestEkle from './TestEkle';
import SifremiUnuttum from './SifremiUnuttum';
import BanliPanel from './BanliPanel'; // BanliPanel.js dosyasını doğrudan src'den alıyoruz






function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Layout'un GÖRÜNMEYECEĞİ sayfalar */}
          <Route path="/" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/banli-panel" element={<BanliPanel />} />

          {/* Layout'un GÖRÜNECEĞİ sayfalar */}
          <Route element={<Layout />}>
            <Route path="/main" element={<Main />} />
            <Route path="/hastaliklar/:hastalikSlug" element={<HastalikDetay />} />
            <Route path="/sorular" element={<SoruListesi />} />
            <Route path="/sorular/:soruId" element={<SoruDetay />} />
            <Route path="/soru-sor" element={<SoruSor />} />
            <Route path="/tartisma-olustur" element={<TartismaEkle />} />
            <Route path="/paylasim-yap/:hastalikSlug" element={<YeniPaylasim />} />
            <Route path="/profilim" element={<Profil />} />
            <Route path="/profil/duzenle" element={<ProfilDuzenle />} />
            <Route path="/profil/sifre" element={<SifreDegistir />} /> 
            <Route path="/profil/:userId" element={<KullaniciProfil />} /> 
            <Route path="/takip-listesi/:userId" element={<TakipListesi />} />
            <Route path="/ara" element={<Ara />} />
            <Route path="/PaylasimDetay/:paylasimId" element={<PaylasimDetay />} />
            <Route path="/tartismalar" element={<TartismaListesi />} />
            <Route path="/tartismalar/:tartismaId" element={<TartismaDetay />} />
            <Route path="/YorumKarti" element={<YorumKarti />} />
            <Route path="/testler" element={<TestListesi />} />
            <Route path="/test/:testId" element={<TestDetay />} />
            <Route path="/ruh-halim" element={<GunlukPuanlama />} />
            <Route path="/iletisim" element={<Iletisim />} />
            <Route path="/testekle" element={<TestEkle />} />
            <Route path="/sifremiunuttum" element={<SifremiUnuttum />} />
            

            
            
            {/* Admin Route */}
            <Route element={<AdminRoute />}>
              <Route path="/admin-paneli" element={<AdminPaneli />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;