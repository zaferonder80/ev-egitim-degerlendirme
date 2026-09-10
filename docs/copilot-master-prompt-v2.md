# E/V Eğitim Değerlendirme Sistemi: Copilot Master Prompt (V2)

Aşağıdaki metin, Copilot'un (veya benzeri bir yapay zekanın) sistemi en baştan, tüm detaylarıyla ve modern bir vizyonla tasarlaması için optimize edilmiştir.

---

## Copilot İçin Uygulama Tasarım Yönergesi

**GÖREV TANIMI:**
Kurumsal bir "Eğitim İçerik Değerlendirme Sistemi"ni (E/V Sistemi) uçtan uca, modern, estetik ve yüksek performanslı bir kullanıcı deneyimi ile yeniden tasarla. Bu sistem; eğitimlerin adminler tarafından yönetildiği, değerlendiriciler tarafından 8 standart kriter üzerinden puanlandığı ve sonuçların raporlandığı bir platformdur.

### 1. Görsel Kimlik ve Tasarım Sistemi
- **Vizyon:** Güven veren, profesyonel, ferah ve kurumsal bir "SaaS" arayüzü.
- **Renkler:**
  - **Ana:** Derin Safir Lacivert (Örn: `#0b385d`) ve Kristal Beyaz.
  - **Vurgu:** Canlı Teal/Zümrüt (Örn: `#14a6a0`) ve Yumuşak Altın.
  - **Arka Plan:** Çok açık gri-mavi (Örn: `#f5f8fb`).
- **Bileşen Stili:** Shadcn/ui kütüphanesini temel al. Kartlarda yumuşak gölgeler, butonlarda net mikro etkileşimler ve tutarlı iç boşluklar kullan.
- **Tipografi:** Okunabilirlik için modern bir sans-serif (Inter/Manrope) ve başlık vurguları için prestijli bir serif (Playfair Display) kombinasyonu yap.

### 2. Fonksiyonel Ekran Yapıları
#### A. Giriş ve Karşılama (Login)
İki bölümlü modern bir sayfa tasarla. Sol tarafta sistemin amacını anlatan bir "Hero" alanı (marka logoları, güven maddeleri), sağ tarafta ise temiz bir giriş formu yer almalı.

#### B. Yönetim Merkezi (Admin)
- **Dashboard:** 6 ana metriği (Toplam Eğitim, Tamamlanan, Başarı Oranı vb.) içeren görsel kartlar. Kriter bazlı ortalamaları gösteren interaktif sütun grafikleri ve başarı dağılımı için halka grafik.
- **Eğitim ve Kullanıcı Yönetimi:** Veri yoğunluğunu yöneten, sıralanabilir ve filtrelenebilir tablolar. Yeni eğitim ekleme ekranında dosya yükleme, kapak görseli ve zengin metin alanları.
- **Toplu Atama:** Eğitimleri birden fazla değerlendiriciye tek seferde atamayı sağlayan, checkbox listeli modern bir modal arayüzü.

#### C. Değerlendirme Alanı (Evaluator)
- **İş Listesi:** Yaklaşan son tarihleri görsel uyarılarla (badge/renk) belirten kart tabanlı atama listesi.
- **Değerlendirme Formu:** 8 kriterin (K1-K8) her biri için 1-5 puan skalası ve açıklama alanı içeren, kullanıcının odağını bozmayan "stepper" veya temiz kart yapısı. Sağ panelde eğitimin tüm detaylarını (künye, amaçlar, kaynaklar) gösteren bilgi sekmesi.

### 3. İş Mantığı ve Teknik Standartlar
- **Dil ve Yerelleştirme:** Tüm metinler profesyonel bir Türkçe ile yazılmalıdır.
- **Değerlendirme Kuralı:** 8 kriter üzerinden puanlama yapılır. Toplam 40 puan üzerinden 28 puan (%70) alan eğitimler "Başarılı" kabul edilir.
- **Yetkilendirme:** Admin (Tam yetki) ve Değerlendirici (Sınırlı yetki) rolleri arasında net bir ayrım olmalıdır.
- **Mimari:** React 19, Tailwind CSS 4 ve tRPC prensiplerine uygun, temiz ve modüler bir kod yapısı üret.

**HEDEF:** Bu uygulamayı sadece bir veri giriş aracı olarak değil, kurumsal bir prestij platformu olarak kurgula. Her ekranın birbiriyle görsel bir bütünlük içinde olmasını sağla.
