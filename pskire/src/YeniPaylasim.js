
// React ve ilgili temel "hook"ları (useState, useEffect) import ediyoruz.
import React, { useState, useEffect } from 'react';
// Sayfalar arası yönlendirme ve URL'den parametre okuma için gerekli hook'ları import ediyoruz.
import { useParams, useNavigate } from 'react-router-dom';
// Bu component'e özel CSS stil dosyasını import ediyoruz.
import './css/YeniPaylasim.css';
// Uygulama genelinde kullanıcı bilgilerini yöneten AuthContext'ten, mevcut kullanıcıya erişmek için useAuth hook'unu import ediyoruz.
import { useAuth } from './context/AuthContext';

// YeniPaylasim adında bir React functional component'i tanımlıyoruz.
function YeniPaylasim() {
    // useParams hook'u ile URL'deki dinamik parametreyi yakalıyoruz. Örn: /paylasim-yap/depresyon -> 'depresyon'
    const { hastalikSlug } = useParams();
    // useNavigate hook'u ile, bir işlem sonrası kullanıcıyı başka bir sayfaya yönlendirmemizi sağlayacak fonksiyonu alıyoruz.
    const navigate = useNavigate();
    // useAuth hook'u ile o an giriş yapmış olan kullanıcının bilgilerini (id, username vb.) alıyoruz.
    const { currentUser } = useAuth();

    // --- STATE (DURUM) YÖNETİMİ ---
    // useState hook'ları ile component'in hafızasında tutulacak ve değiştiklerinde arayüzün yeniden çizilmesini tetikleyecek verileri tanımlıyoruz.

    // Sayfa yüklendiğinde API'den çekilecek olan hastalık detaylarını (id, isim vb.) saklamak için. Başlangıç değeri null (boş).
    const [hastalik, setHastalik] = useState(null);
    // Formdaki ana paylaşım alanlarının (başlık, içerik, anonim checkbox) anlık değerlerini tutan bir obje.
    const [paylasim, setPaylasim] = useState({
        title: '',
        content: '',
        isAnonymous: false
    });
    // Kullanıcının formda "Ekle" butonuyla eklediği ilaçları geçici olarak tutan dizi.
    const [secilenIlaclar, setSecilenIlaclar] = useState([]);
    // Kullanıcının "Ekle" butonuyla eklediği yan etkileri geçici olarak tutan dizi.
    const [secilenYanetkiler, setSecilenYanetkiler] = useState([]);
    // İlaç ekleme bölümündeki dropdown ve metin kutusunun anlık değerlerini tutan obje.
    const [yeniIlac, setYeniIlac] = useState({ medicine_id: '', content: '' });
    // Yan etki ekleme bölümündeki dropdown ve metin kutusunun anlık değerlerini tutan obje.
    const [yeniYanetki, setYeniYanetki] = useState({ sideeffects_id: '', content: '' });
    // API'den çekilecek olan tüm ilaçların listesi. Bu, ilaç seçme dropdown'ını doldurmak için kullanılır.
    const [tumIlaclar, setTumIlaclar] = useState([]);
    // API'den çekilecek olan tüm yan etkilerin listesi. Bu, yan etki seçme dropdown'ını doldurmak için kullanılır.
    const [tumYanetkiler, setTumYanetkiler] = useState([]);
    // Sayfa ilk açıldığında veriler API'den gelene kadar bir yüklenme göstergesi göstermek için kullanılan boolean (true/false) state.
    const [loading, setLoading] = useState(true);

    // YENİ EKLENEN STATE'LER: Kullanıcının seçtiği dosyaları ve önizlemelerini tutmak için.
    const [files, setFiles] = useState([]);
    const [filePreviews, setFilePreviews] = useState([]);

    // useEffect hook'u, component ilk render edildiğinde veya bağımlılık listesindeki ([hastalikSlug, navigate]) bir state/prop değiştiğinde çalışır.
    useEffect(() => {
        // Asenkron bir fonksiyon tanımlıyoruz çünkü API'den veri çekme işlemi zaman alabilir ve programın beklemesi gerekir.
        const fetchInitialData = async () => {
            try {
                // Backend'deki API endpoint'ine (veri adresine) bir GET isteği gönderiyoruz. URL'ye o anki hastalığın slug'ını ekliyoruz.
                const response = await fetch(`/api/yeni-paylasim-veri/${hastalikSlug}`);
                // Eğer sunucudan gelen cevap "başarılı" değilse (örn: 404 sayfa bulunamadı hatası), bir hata fırlatıyoruz.
                if (!response.ok) {
                    throw new Error('Veri çekilemedi.');
                }
                // Sunucudan gelen JSON formatındaki cevabı JavaScript objesine çeviriyoruz.
                const data = await response.json();

                // Gelen verileri ilgili state'lere kaydediyoruz. Bu `set` fonksiyonları tetiklendiğinde, arayüz otomatik olarak güncellenir.
                setHastalik(data.hastalik);
                setTumIlaclar(data.tumIlaclar);
                setTumYanetkiler(data.tumYanetkiler);

            } catch (error) {
                // Yukarıdaki `try` bloğunda bir hata oluşursa (örn: ağ hatası, 404), bu blok çalışır.
                console.error("Başlangıç verileri çekilirken hata:", error);
                // Kullanıcıya bir uyarı gösterip, onu ana sayfaya yönlendiriyoruz.
                alert('Hastalık bilgisi bulunamadı, ana sayfaya yönlendiriliyorsunuz.');
                navigate('/');
            } finally {
                // `try` veya `catch` bloklarından hangisi çalışırsa çalışsın, `finally` bloğu en sonunda her zaman çalışır.
                // Yüklenme işlemini bitiriyoruz.
                setLoading(false);
            }
        };
        // Tanımladığımız veri çekme fonksiyonunu çağırıyoruz.
        fetchInitialData();
    // Bağımlılık dizisi: Bu useEffect'in sadece `hastalikSlug` veya `Maps` değiştiğinde tekrar çalışmasını sağlar. Genellikle component ilk yüklendiğinde bir kez çalışması için kullanılır.
    }, [hastalikSlug, navigate]);

    // --- OLAY YÖNETİCİLERİ (EVENT HANDLERS) ---
    // Bu fonksiyonlar, kullanıcının form elemanlarıyla (input, button, vb.) etkileşime girdiğinde çalışır.

    // Paylaşımın başlık, içerik veya anonim checkbox'ı değiştiğinde çalışır.
    const handlePaylasimChange = e => {
        // `e` (event objesi), olayın gerçekleştiği elementle ilgili tüm bilgileri içerir.
        // `e.target` ise olayın kaynağı olan HTML elementidir (örn: tıkladığımız input).
        const { name, value, type, checked } = e.target;
        // `paylasim` state'ini güncelliyoruz.
        // `...paylasim` (spread syntax) ile objenin mevcut değerlerini kopyalıyoruz.
        // `[name]` ile değişen alanın `name` özelliğini (örn: "title", "content") alıp değerini güncelliyoruz.
        // Eğer element bir checkbox ise değeri `checked` (true/false) özelliğinden, değilse `value` özelliğinden alıyoruz.
        setPaylasim({ ...paylasim, [name]: type === 'checkbox' ? checked : value });
    };

    // İlaç ekleme bölümündeki input/select değiştiğinde `yeniIlac` state'ini günceller.
    const handleYeniIlacChange = e => setYeniIlac({ ...yeniIlac, [e.target.name]: e.target.value });
    // Yan etki ekleme bölümündeki input/select değiştiğinde `yeniYanetki` state'ini günceller.
    const handleYeniYanetkiChange = e => setYeniYanetki({ ...yeniYanetki, [e.target.name]: e.target.value });

    // "İlaç Ekle" butonuna tıklandığında çalışır.
    const handleIlacEkle = () => {
        // `.trim()` fonksiyonu metnin başındaki ve sonundaki boşlukları siler. Kullanıcının sadece boşluk girmesini engeller.
        if (!yeniIlac.medicine_id || !yeniIlac.content.trim()) return alert('Lütfen ilaç seçin ve açıklama yazın.');
        // Seçilen ilacın ID'sini kullanarak `tumIlaclar` dizisinden tam ilaç adını buluyoruz.
        const ilacDetay = tumIlaclar.find(i => i.id === parseInt(yeniIlac.medicine_id));
        // `secilenIlaclar` dizisine yeni ilacı ekliyoruz. `...secilenIlaclar` ile eski diziyi kopyalayıp sonuna yeni elemanı ekliyoruz.
        // `Date.now()` ile her eklenen elemana benzersiz bir geçici ID veriyoruz, bu React'in listeyi render etmesi için gereklidir.
        setSecilenIlaclar([...secilenIlaclar, { id: Date.now(), medicine_id: parseInt(yeniIlac.medicine_id), content: yeniIlac.content, medicine_name: ilacDetay.medicine_name }]);
        // İlaç ekleme formunu temizleyerek bir sonraki eklemeye hazır hale getiriyoruz.
        setYeniIlac({ medicine_id: '', content: '' });
    };

    // "Yan Etki Ekle" butonuna tıklandığında çalışır. (Mantık handleIlacEkle ile aynıdır)
    const handleYanetkiEkle = () => {
        if (!yeniYanetki.sideeffects_id || !yeniYanetki.content.trim()) return alert('Lütfen yan etki seçin ve açıklama yazın.');
        const yanetkiDetay = tumYanetkiler.find(y => y.id === parseInt(yeniYanetki.sideeffects_id));
        setSecilenYanetkiler([...secilenYanetkiler, { id: Date.now(), sideeffects_id: parseInt(yeniYanetki.sideeffects_id), sideeffects_name: yanetkiDetay.sideeffects_name, content: yeniYanetki.content }]);
        setYeniYanetki({ sideeffects_id: '', content: '' });
    };

    // Eklenen bir ilacı veya yan etkiyi listeden kaldırmak için genel bir fonksiyon.
    // `.filter()` metodu, bir koşulu sağlayan elemanlardan yeni bir dizi oluşturur. Burada, ID'si kaldırılmak istenen ID'ye eşit olmayan tüm elemanları tutarak yeni bir dizi oluşturuyoruz.
    const handleKaldir = (liste, setListe, id) => setListe(liste.filter(item => item.id !== id));

    // YENİ EKLEME: Dosya seçimini yöneten fonksiyon
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const newFiles = [...files, ...selectedFiles];

        if (newFiles.length > 10) {
            alert("En fazla 10 fotoğraf yükleyebilirsiniz.");
            return;
        }

        setFiles(newFiles);
        
        // Yeni dosya önizleme URL'leri oluştur
        const newPreviews = newFiles.map(file => URL.createObjectURL(file));
        setFilePreviews(newPreviews);
    };

    // YENİ EKLEME: Dosya kaldırmayı yöneten fonksiyon
    const handleFileRemove = (index) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        setFiles(newFiles);

        const newPreviews = [...filePreviews];
        URL.revokeObjectURL(newPreviews[index]); // Eski URL'yi temizle
        newPreviews.splice(index, 1);
        setFilePreviews(newPreviews);
    };

    // Form gönderildiğinde ("Paylaşımı Gönder" butonuna tıklandığında) çalışır.
    const handleSubmit = async (e) => {
        // `e.preventDefault()`: Formun varsayılan gönderme davranışı olan sayfa yenilemeyi engeller.
        e.preventDefault();

        // Kullanıcının giriş yapıp yapmadığını kontrol ediyoruz.
        if (!currentUser) {
            alert('Paylaşım yapmak için lütfen giriş yapınız.');
            navigate('/login');
            return; // Fonksiyonun devam etmesini engeller.
        }
        // Başlık ve içerik alanlarının boş olup olmadığını kontrol ediyoruz.
        if (!paylasim.title.trim() || !paylasim.content.trim()) {
            alert('Paylaşım başlığı ve içeriği zorunludur.');
            return;
        }
        
        // YENİ EKLEME: FormData objesi oluşturma
        // Dosya yüklerken, verileri FormData objesi içinde göndermek gerekir.
        const formData = new FormData();
        
        // Form verilerini ve dosyaları FormData objesine ekleme
        formData.append('paylasim', JSON.stringify({
            title: paylasim.title,
            content: paylasim.content,
            isAnonymous: paylasim.isAnonymous,
            illness_id: hastalik.id,
            user_id: currentUser.id,
            ilaclar: secilenIlaclar.map(ilac => ({
                medicine_id: parseInt(ilac.medicine_id),
                content: ilac.content
            })),
            yanetkiler: secilenYanetkiler.map(yanetki => ({
                sideeffects_id: parseInt(yanetki.sideeffects_id),
                content: yanetki.content
            }))
        }));

        // Seçilen her dosyayı 'images' adında FormData objesine ekliyoruz. Backend'deki 'multer' bu isimle dosyaları yakalayacaktır.
        files.forEach(file => {
            formData.append('images', file);
        });

        try {
            // `fetch` ile backend'deki API endpoint'ine bir POST isteği atıyoruz.
            const response = await fetch('/api/paylasimkaydet', {
                method: 'POST', // İstek metodunu belirtiyoruz.
                // ÖNEMLİ: Dosya yüklerken `Content-Type` başlığını manuel olarak **belirtmeyin**. Tarayıcı `FormData` için bunu otomatik olarak doğru şekilde ayarlar.
                body: formData // FormData objesini isteğin gövdesine ekliyoruz.
            });

            // Eğer backend'den gelen cevap başarılıysa (HTTP 200-299 arası bir kod)...
            if (response.ok) {
                alert('Paylaşımınız başarıyla gönderildi!');
                // Kullanıcıyı, paylaşım yaptığı hastalığın detay sayfasına yönlendiriyoruz.
                navigate(`/hastaliklar/${hastalikSlug}`);
            } else {
                // Eğer backend bir hata döndürdüyse, hata mesajını alıp kullanıcıya gösteriyoruz.
                const errorData = await response.json();
                alert(`Bir hata oluştu: ${errorData.message}`);
            }
        } catch (error) {
            // Ağ hatası gibi (sunucuya ulaşılamaması) bir sorun olursa bu blok çalışır.
            console.error('Paylaşım gönderme hatası:', error);
            alert('Paylaşım gönderilirken bir ağ hatası oluştu.');
        }
    };

    // Veri yüklenirken veya hastalık bilgisi henüz gelmemişken ekranda bir "yükleniyor" mesajı gösteriyoruz.
    // Bu, kullanıcının boş veya hatalı bir sayfa görmesini engeller (Conditional Rendering).
    if (loading || !hastalik) return <div>Hastalık bilgisi yükleniyor...</div>;

    // Her şey yüklendikten sonra, formun ve diğer elemanların render edileceği JSX kodunu return ediyoruz.
    return (
        <div className="yeni-paylasim-container">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-lg-9">
                        <h1 className="page-title">"{hastalik.illness_name}" Hakkında Yeni Paylaşım</h1>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="card paylasim-card">
                                <div className="card-body p-4">
                                    <div className="mb-3">
                                        <label htmlFor="title" className="form-label">Başlık</label>
                                        {/* `value` ve `onChange` ile bu input'u `paylasim` state'ine bağlıyoruz (controlled component). */}
                                        <input type="text" name="title" id="title" className="form-control custom-input" value={paylasim.title} onChange={handlePaylasimChange} required />
                                    </div>
                                    <div>
                                        <label htmlFor="content" className="form-label">Deneyiminiz</label>
                                        <textarea name="content" id="content" rows="8" className="form-control custom-textarea" value={paylasim.content} onChange={handlePaylasimChange} required></textarea>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="card paylasim-card">
                                <div className="card-header"><h5 className="mb-0">Kullanılan İlaçları Ekle</h5></div>
                                <div className="card-body p-4">
                                    {/* Conditional Rendering: Sadece `secilenIlaclar` dizisinde eleman varsa bu listeyi göster. */}
                                    {secilenIlaclar.length > 0 && <ul className="list-unstyled mb-3 secilen-liste">{secilenIlaclar.map((ilac) => (<li key={ilac.id} className="d-flex justify-content-between align-items-center secilen-liste-item"><div><strong>{ilac.medicine_name}:</strong> {ilac.content}</div><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleKaldir(secilenIlaclar, setSecilenIlaclar, ilac.id)}>&times;</button></li>))}</ul>}
                                    <div className="input-group ekleme-grubu">
                                        {/* Dropdown menüsü, `tumIlaclar` state'indeki verilerle dinamik olarak dolduruluyor. */}
                                        <select name="medicine_id" className="form-select" value={yeniIlac.medicine_id} onChange={handleYeniIlacChange}>
                                            <option value="">İlaç Seç...</option>
                                            {tumIlaclar.map(i => <option key={i.id} value={i.id}>{i.medicine_name}</option>)}
                                        </select>
                                        <input type="text" name="content" className="form-control w-50" placeholder="İlaçla ilgili deneyim (dozaj, etki vb.)" value={yeniIlac.content} onChange={handleYeniIlacChange} />
                                        <button type="button" className="btn btn-success" onClick={handleIlacEkle}>Ekle</button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="card paylasim-card">
                                <div className="card-header"><h5 className="mb-0">Görülen Yan Etkileri Ekle</h5></div>
                                <div className="card-body p-4">
                                    {secilenYanetkiler.length > 0 && <ul className="list-unstyled mb-3 secilen-liste">{secilenYanetkiler.map(yanetki => (<li key={yanetki.id} className="d-flex justify-content-between align-items-center secilen-liste-item"><div><strong>{yanetki.sideeffects_name}:</strong> {yanetki.content}</div><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleKaldir(secilenYanetkiler, setSecilenYanetkiler, yanetki.id)}>&times;</button></li>))}</ul>}
                                    <div className="input-group ekleme-grubu">
                                        <select name="sideeffects_id" className="form-select" value={yeniYanetki.sideeffects_id} onChange={handleYeniYanetkiChange}>
                                            <option value="">Yan Etki Seç...</option>
                                            {tumYanetkiler.map(y => <option key={y.id} value={y.id}>{y.sideeffects_name}</option>)}
                                        </select>
                                        <input type="text" name="content" className="form-control w-50" placeholder="Yan etkiyle ilgili deneyim (süre, şiddet vb.)" value={yeniYanetki.content} onChange={handleYeniYanetkiChange} />
                                        <button type="button" className="btn btn-success" onClick={handleYanetkiEkle}>Ekle</button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* YENİ EKLENEN KISIM: Fotoğraf Ekleme Alanı */}
                            <div className="card paylasim-card">
                                <div className="card-header"><h5 className="mb-0">Fotoğraf Ekle ({files.length}/10)</h5></div>
                                <div className="card-body p-4">
                                    <div className="mb-3">
                                        <label htmlFor="file-input" className="form-label">Maksimum 10 fotoğraf yükleyebilirsiniz (isteğe bağlı).</label>
                                        <input 
                                            type="file" 
                                            id="file-input" 
                                            className="form-control" 
                                            multiple 
                                            accept="image/*"
                                            onChange={handleFileChange} 
                                            disabled={files.length >= 10}
                                        />
                                    </div>
                                    
                                    {/* Önizlemeler */}
                                    {filePreviews.length > 0 && (
                                        <div className="d-flex flex-wrap gap-2 mt-3">
                                            {filePreviews.map((preview, index) => (
                                                <div key={index} className="preview-container">
                                                    <img src={preview} alt={`preview-${index}`} className="img-thumbnail" />
                                                    <button 
                                                        type="button" 
                                                        className="btn-close remove-btn" 
                                                        aria-label="Kaldır" 
                                                        onClick={() => handleFileRemove(index)}
                                                    ></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* BİTİŞ: Fotoğraf Ekleme Alanı */}

                            <div className="form-check form-switch anonymous-switch-container">
                                <input className="form-check-input" type="checkbox" role="switch" id="isAnonymous" name="isAnonymous" checked={paylasim.isAnonymous} onChange={handlePaylasimChange} />
                                <label className="form-check-label anonymous-label" htmlFor="isAnonymous">
                                    <strong>Anonim Olarak Paylaş</strong>
                                    <div className="form-text mt-1">Bu seçeneği işaretlerseniz paylaşımınız profilinizle ilişkilendirilmez ve kimliğiniz gizli kalır.</div>
                                </label>
                            </div>
                            
                            <div className="d-grid mt-4">
                                <button type="submit" className="btn btn-lg submit-btn">Paylaşımı Gönder</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Bu component'i, uygulamanın başka yerlerinde kullanabilmek için dışa aktarıyoruz.
export default YeniPaylasim;
