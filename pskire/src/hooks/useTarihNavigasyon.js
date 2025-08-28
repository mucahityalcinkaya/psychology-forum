import { useMemo } from 'react';

// === YARDIMCI FONKSİYON: Tarihe göre hafta numarasını verir ===
// https://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php
function getHaftaNumarasi(tarih) {
    const d = new Date(Date.UTC(tarih.getFullYear(), tarih.getMonth(), tarih.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Formatlama için (örn: "4 Ağu")
const formatDateShort = (tarih) => new Date(tarih).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });

// ==== ÖZEL HOOK ====
export const useTarihNavigasyon = (gosterilenTarih, mod) => {

    return useMemo(() => {
        const simdi = new Date();
        const mevcutTarih = new Date(gosterilenTarih); // Prop'tan gelen tarihi kopyala

        let baslangicTarihi;
        let bitisTarihi;
        let etiket = ''; // Gösterilecek başlık (örn: Ağustos 2025)

        if (mod === 'hafta') {
            const gun = mevcutTarih.getDay(); // Pazar: 0, Pts: 1...
            const fark = gun === 0 ? 6 : gun - 1; // Haftanın başlangıcını Pazartesi yap
            
            baslangicTarihi = new Date(mevcutTarih.setDate(mevcutTarih.getDate() - fark));
            baslangicTarihi.setHours(0,0,0,0);
            
            bitisTarihi = new Date(baslangicTarihi);
            bitisTarihi.setDate(baslangicTarihi.getDate() + 6);
            bitisTarihi.setHours(23,59,59,999);
            
            const haftaNo = getHaftaNumarasi(baslangicTarihi);
            etiket = `Hafta ${haftaNo}: ${formatDateShort(baslangicTarihi)} - ${formatDateShort(bitisTarihi)}`;
        } else { // mod === 'ay'
            baslangicTarihi = new Date(mevcutTarih.getFullYear(), mevcutTarih.getMonth(), 1);
            bitisTarihi = new Date(mevcutTarih.getFullYear(), mevcutTarih.getMonth() + 1, 0); // Ayın son gününü bulma tekniği
            bitisTarihi.setHours(23,59,59,999);

            etiket = mevcutTarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
        }
        
        // Geleceğe gitmeyi engellemek için ileri butonunun aktif olup olmadığını hesapla
        const isIleriButonuAktif = bitisTarihi < simdi;

        return { baslangicTarihi, bitisTarihi, etiket, isIleriButonuAktif };

    }, [gosterilenTarih, mod]);
};