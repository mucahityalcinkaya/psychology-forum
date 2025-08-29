import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './css/TestDetay.css'

function TestDetay() { // function içerisine global parametrelerimizi tanımlıyoruz.
    const { testId } = useParams(); // urlden gelen testId bileşenini aldık
    const [test, setTest] = useState(null); //testin bilgilerini almak içi bileşen oluşturduk
    const [sorular, setSorular] = useState([]); // o testin sorularını almak için bileşen oluşturduk
    const [sonuclar, setSonuclar] = useState([]); // o testin sonuçlarını almak için bileşen oluşturduk
    const [aktifSoruIndex, setAktifSoruIndex] = useState(0); // hangi soruda olduğumuzu takip etmke için index oluşturduk
    const [sonuclarPuanlari, setSonuclarPuanlari] = useState({}); // puanları aldık
    const [testBitti, setTestBitti] = useState(false); // testbitti diye boolean tanımladık
    const [finalSonuc, setFinalSonuc] = useState(null); // finalsonucu için tanımladık
    const [loading, setLoading] = useState(true); // yüklenirken durum kontrolü


    useEffect(() => { // [testId] böyle verdiğimiz her kısım değiştiğünde çalışır [] ise sayfa yüklendiğinde çalışır
        if (testId) {
            verileriCek(); // testId her değiştiğinde bu çalışır 
        }
    }, [testId]);

    const verileriCek = async () => { // async kullancık parantez içine bişi eklemedik çünkü parametre almıyor.
        setLoading(true); //yükleniyoru true yaptık
        
        try {
            const testResponse = await fetch(`/api/testler/${testId}`); //testin idsini gönderiyoruz bu sayede  o testle alakaı bilgiler gelecek bize 
            const testData = await testResponse.json(); //gelen responsu json formatına çevirdik
            setTest(testData); // ve Test i güncelledik
            
            const sorularResponse = await fetch(`/api/testsorular/${testId}`); // test idsini gönderip o test idsinin şit olduğu soruları alıyoruz 
            const sorularData = await sorularResponse.json(); //gelen responsu json formatına çevirdik
            
            const sorularVeCevaplar = []; // her sorunun kendi içinde cevabı olduğu için her soru ile cevabını birleştireceğiz.
            
            for (const soru of sorularData) { // for döngüsü açacağız soruları tek tek alıyoruz
                const cevaplarResponse = await fetch(`/api/cevaplar/${soru.id}`); // o sorunun idsine sahip olan cevapları alıyoruz
                const cevaplarData = await cevaplarResponse.json(); //json ile çeviriyoruz
                
                sorularVeCevaplar.push({ //oluşturduğumuz diziye ekliyoruz
                    ...soru,    //soruyu kopyalıyoruz
                    cevaplar: cevaplarData //o soruların cevaplarını da o soru ile beraber ekliyoruz
                });
            }
            setSorular(sorularVeCevaplar); // En son sorular değişkenine aktarıyoruz.
            
            const sonuclarResponse = await fetch(`/api/sonuclar/${testId}`); // o test idsine göre sonucları alıyoruz
            const sonuclarData = await sonuclarResponse.json(); // jsona çeviriyoruz
            setSonuclar(sonuclarData); // Sonuclar değişkenine atıyoruz
            
            const initialPuanlar = {}; // boş oluşturuyoruz
            sonuclarData.forEach(sonuc => { // her bi sonucun puanını sıfırlıyoruz
                initialPuanlar[sonuc.id] = 0;
            });
            setSonuclarPuanlari(initialPuanlar); // SonuclarPuanları değişkenine atıyoruz
            
        } catch (error) { //hata varsa yakalıyoruz
            console.error('Veri çekme hatası:', error);
        } finally {
            setLoading(false); // en son işlemler bittiğinde yükleniyoru false yapıyoruz
        }
    };

    useEffect(() => {
        if (testBitti && !finalSonuc) { // Test bitti ama henüz sonuçlanmamış ise sonuçla yapıyoruz
            hesaplaSonuc();
        }
    }, [testBitti, finalSonuc]); // testbitince veya finalsonuc değişince useEffect çalışıyor

    const handleCevapSec = (puanTipi) => { // handlecevapSec e tıklanınca puan tipine bakıyoruz
        if (puanTipi) {
            setSonuclarPuanlari(prevPuanlar => ({
                ...prevPuanlar, //önceki prev puanları kopyaladık 
                [puanTipi]: (prevPuanlar[puanTipi] || 0) + 1 // prevPuanlar[puanTipi] var mı diye || kullandık undefined ise 0 kullanacak 
            }));
        }
        
        const sonrakiSoruIndex = aktifSoruIndex + 1; // index numarasını artırıyoruz
        if (sonrakiSoruIndex < sorular.length) { // hala soru var mı diye sorular ın uzunluğu ile kontrol ediyoruz 
            setAktifSoruIndex(sonrakiSoruIndex); //yoksa AktifSoruIndex değişkenini güncelliyoruz.
        } else {
            setTestBitti(true); // yoksa testbittiyi true yapıyoruz
        }
    };

    const hesaplaSonuc = () => {
        let enYuksekPuan = -1; // eksi bir yaptık çünkü sonuçların hepsi 0 olursa kazanan belirlenemez
        let kazananTipId = null;
        
        for (const tipId in sonuclarPuanlari) { //tek tek soru tiplerine bakıyoruz
            if (sonuclarPuanlari[tipId] > enYuksekPuan) { // eğer en yüksek puandan büyükse
                enYuksekPuan = sonuclarPuanlari[tipId]; // yeni yüksek puan o oluypr
                kazananTipId = tipId; // kazanan tip id de oluyor
            }
        }
        
        const sonucDetayi = sonuclar.find(s => s.id.toString() === kazananTipId); // sonuçalrda kazanan sidye sahip sonucu aradık idyi strign yaptık çünkü karşılaştırma
        if (sonucDetayi) { // eğer varsa
            setFinalSonuc({ ...sonucDetayi }); // Final sonucu güncelledik
        } else {
            setFinalSonuc({ //eğer yoksa 
                baslik: "Dengeli Bir Yaklaşım Sergiliyorsun",
                aciklama: "Verdiğin yanıtlara göre şu an belirgin bir psikolojik zorlanma yaşamıyor olabilirsin.",
                icon: "bi-emoji-sunglasses-fill text-primary"
            });
        }
    };

    const testiYenidenBaslat = () => { // testi yeniden başlatmak için 
        setAktifSoruIndex(0); // indexi sıfırladık
        setTestBitti(false); // durumu günceleldik
        setFinalSonuc(null); // sonucu güncelledik
        
        const initialPuanlar = {};
        sonuclar.forEach(sonuc => {
            initialPuanlar[sonuc.id] = 0;
        });
        setSonuclarPuanlari(initialPuanlar); // puanları sıfırladık
    };

    if (loading) { // loading yüklendiğinde test yükleniyor uyarısı gelecek
        return (
            <div className="container my-5 text-center">
                <div className="spinner-border" role="status">
                    <span className="visually-hidden">Yükleniyor...</span>
                </div>
                <h2 className="mt-3">Test Yükleniyor...</h2>
            </div>
        );
    }

    if (!test) { // test yoksa test bulunamadı diyecek
        return (
            <div className="container my-5 text-center">
                <h2>Test bulunamadı.</h2>
                <Link to="/testler" className="btn btn-primary">Testlere Dön</Link>
            </div>
        );
    }

    return (
        <div className="test-detay-container">
            <div className="container d-flex justify-content-center">
                <div className="col-lg-9">
                    <div className="card text-center shadow-lg test-karti">
                        <div className="card-header bg-white py-3">
                            <h4 className="fw-light mb-0">{test.title}</h4>
                        </div>
                        <div className="card-body test-karti-govde">
                            {!testBitti ? ( // test bitmediyse ve sorular 0 dan fazlaysa
                                sorular.length > 0 && (
                                    <>
                                        <p className="text-muted">
                                            Soru {aktifSoruIndex + 1} / {sorular.length}
                                        </p>
                                        
                                        <div className="progress-container mb-4">
                                            <div
                                                className="progress-bar"
                                                role="progressbar"
                                                style={{ 
                                                    width: `${((aktifSoruIndex + 1) / sorular.length) * 100}%` 
                                                }}
                                            />
                                        </div>
                                        
                                        <h3 className="soru-metni my-4">
                                            {sorular[aktifSoruIndex]?.soru_metni}
                                        </h3>
                                        
                                        {sorular[aktifSoruIndex]?.image_data && (
                                            <div className="soru-gorsel">
                                                <img 
                                                    // API'den gelen verilerle Data URL oluşturuyoruz
                                                    src={`data:${sorular[aktifSoruIndex].image_mime_type};base64,${sorular[aktifSoruIndex].image_data}`}
                                                    alt={`Soru ${aktifSoruIndex + 1}`} 
                                                />
                                            </div>
                                        )}
                                        
                                        <div className="row g-3 mt-4">
                                            {sorular[aktifSoruIndex]?.cevaplar.map((cevap) => ( // sorunun cevaplar dizisine ulaşmak için cevaplar.map kullandık
                                                <div key={cevap.id} className="col-md-6 d-flex">
                                                    <button 
                                                        onClick={() => handleCevapSec(cevap.puan_tipi)} 
                                                        className="btn cevap-butonu"
                                                    >
                                                        {cevap.metin}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )
                            ) : (
                                finalSonuc && (
                                    <div className="sonuc-ekrani">
                                        <i className={`bi ${finalSonuc.icon} display-2 mb-3`}></i>
                                        <h2 className="card-title">{finalSonuc.baslik}</h2>
                                        <p className="card-text lead my-4">{finalSonuc.aciklama}</p>
                                        <div className="mt-4">
                                            <button 
                                                onClick={testiYenidenBaslat}
                                                className="btn btn-lg me-2 btn-tekrar"
                                            >
                                                Testi Tekrar Çöz
                                            </button>
                                            <Link to="/testler" className="btn btn-secondary btn-lg btn-diger">
                                                Diğer Testler
                                            </Link>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                        <div className="card-footer text-muted bg-light">
                            Bu test tıbbi bir teşhis niteliği taşımaz. Sadece farkındalık amaçlıdır.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TestDetay;