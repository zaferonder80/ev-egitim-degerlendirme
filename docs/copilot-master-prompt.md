# Copilot İçin Uçtan Uca Yeniden Tasarım Master Promptu

Bu doküman, mevcut **E/V Eğitim Değerlendirme Sistemi**'ni en baştan, modern bir vizyonla tasarlatmak için Copilot'a iletilecek nihai yönergedir.

---

## Copilot'a Verilecek Prompt (Kopyala-Yapıştır)

> **GÖREV:** Mevcut bir "Eğitim İçerik Değerlendirme Sistemi"ni uçtan uca, modern, kurumsal ve yüksek kullanıcı deneyimine sahip bir şekilde yeniden tasarla. Bu sistem, eğitim içeriklerini standart 8 kriter üzerinden değerlendiren rol bazlı bir platformdur.
>
> ### 1. TASARIM VİZYONU VE DİLİ
> - **Tema:** "Güven, Şeffaflık ve Profesyonellik" hissi veren modern kurumsal tasarım.
> - **Renk Paleti:** Birincil renk olarak derin safir/lacivert tonları, vurgu rengi olarak canlı teal/zümrüt, arka planda ise temiz, açık gri-mavi tonları kullan.
> - **Stil:** Shadcn/ui bileşenlerini temel alarak, yumuşak köşeli kartlar, tutarlı boşluklar (spacing) ve mikro etkileşimler ekle.
> - **Tipografi:** Arayüz için temiz bir sans-serif (örneğin Inter), başlıklar için prestijli bir serif fontu (örneğin Playfair Display) tercih et.
>
> ### 2. ROL BAZLI EKRAN YAPILARI
> **A. GİRİŞ VE ORTAK ALANLAR:**
> - **Login:** İki kolonlu yapı; solda sistemin değerini anlatan görsel/hero alanı, sağda modern bir giriş formu.
> - **Layout:** Sol tarafta daralabilir (collapsible) bir sidebar, üstte bildirim ve profil erişimi sunan bir header.
>
> **B. ADMİN PANELİ (Yönetici):**
> - **Dashboard:** Toplam eğitim, aktif atama ve başarı oranlarını gösteren özet kartlar. Kriter bazlı puan dağılımını gösteren interaktif sütun grafikleri ve başarı dağılımı için halka (pie) grafik.
> - **Eğitim Yönetimi:** Filtrelenebilir tablo yapısı, yeni eğitim ekleme/düzenleme formu (kod, sürüm, kaynak dosyalar, görsel yükleme dahil).
> - **Kullanıcı ve Atama:** Kullanıcı listesi ve eğitimleri değerlendiricilere toplu olarak atamayı sağlayan checkbox tabanlı modern bir modal arayüzü.
> - **Raporlama:** Değerlendirme sonuçlarını kriter bazlı yorumlarla birlikte sunan, PDF çıktısına uygun temiz bir rapor görünümü.
>
> **C. DEĞERLENDİRİCİ PANELİ:**
> - **Atamalarım:** Yaklaşan teslim tarihlerini vurgulayan kart tabanlı liste görünümü.
> - **Değerlendirme Akışı:** 8 kriterin (K1-K8) her biri için 1-5 puan skalası ve metin alanı içeren, kullanıcının odağını koruyan temiz bir form yapısı. Yan panelde eğitimin künyesini ve kaynaklarını gösteren "Eğitim Bilgileri" sekmesi.
>
> ### 3. TEKNİK VE İŞ KURALLARI
> - **Dil:** Uygulama tamamen Türkçe olmalıdır.
> - **Puanlama:** 1-5 arası tam sayı puanlar. Başarı eşiği %70 (40 üzerinden 28 puan).
> - **RBAC:** Admin ve Değerlendirici rolleri arasında kesin yetki ayrımı.
> - **Teknoloji Beklentisi:** React 19, Tailwind CSS 4 ve tRPC mimarisine uygun, tip güvenli kod yapısı.
>
> **SONUÇ:** Bu sistemi, sadece bir araç değil, bir "kurumsal deneyim" olarak kurgula. Kodları üretirken dosya yapısını, bileşen hiyerarşisini ve Tailwind sınıflarını bu vizyona göre optimize et.

---

## Kullanım Önerileri
1.  **Parçalı Yaklaşım:** Copilot'a tüm promptu tek seferde vermek yerine, önce "Tasarım Sistemi ve Layout"u, ardından "Admin Ekranları"nı ve son olarak "Değerlendirici Akışı"nı adım adım yaptırabilirsiniz.
2.  **Görsel Referans:** Eğer Copilot'un görsel anlama yeteneği varsa, mevcut ekranların ekran görüntülerini de bu promptla birlikte yüklemek, değişimin boyutunu anlamasına yardımcı olur.
3.  **Bileşen Kütüphanesi:** Promptta belirtilen `shadcn/ui` vurgusu, Copilot'un erişilebilir ve standartlara uygun kod üretmesini sağlar.
