# E/V Eğitim Değerlendirme Sistemi - Teknik ve Tasarım Özeti

## 1. Proje Amacı
Eğitim içeriklerinin 8 ana kriter üzerinden kurumsal bir standartla değerlendirilmesini sağlayan, rol bazlı (Admin/Değerlendirici) bir web uygulamasıdır.

## 2. Tasarım Sistemi (Mevcut)
- **Renk Paleti:**
  - Birincil (Koyu Lacivert): `#0b385d` (Header başlıkları, birincil butonlar)
  - Sidebar Arka Plan: `#092a47`
  - Vurgu Rengi (Teal): `#14a6a0` (Grafikler, ikon arka planları, hover durumları)
  - Sayfa Arka Planı: `#f5f8fb` (Açık gri-mavi)
  - Başarı Durumları: Yeşil (Emerald), Kırmızı (Rose), Sarı (Amber)
- **Tipografi:** `Manrope` (Ana font), `Source Serif 4` (Başlık vurguları)
- **Layout:** Sol tarafta sabit sidebar (278px), üstte yapışkan header, sağda geniş içerik alanı.

## 3. Ana Modüller ve Ekranlar
- **Giriş (Login):** İki kolonlu, solda marka hero alanı, sağda giriş formu.
- **Admin Paneli:**
  - **Dashboard:** 6 metrik kartı, Kriter Puan Grafiği (Bar), Başarı Dağılımı (Pie), Değerlendirici Tamamlanma Oranları (Progress bars).
  - **Eğitim Yönetimi:** Liste, Yeni Kayıt/Düzenleme (Kod, Sürüm, Tür, Süre, Sorumlu, URL, Dosya/Görsel yükleme).
  - **Kullanıcı Yönetimi:** Liste, Şifre Sıfırlama, Rol Tanımlama.
  - **Atama Yönetimi:** Toplu/Tekli değerlendirici atama modalı (Checkbox listesi).
  - **Raporlar:** PDF indirme ve önizleme.
  - **Denetim Kayıtları:** Sistem hareketleri log listesi.
- **Değerlendirici Paneli:**
  - **Dashboard:** Çalışma özeti, bekleyen/tamamlanan sayıları.
  - **Atamalarım:** Eğitim kartları, son tarih uyarıları.
  - **Değerlendirme Formu:** 8 kriterli (1-5 puan + yorum), Eğitim Bilgileri sekmesi (Künye, Amaçlar, Kaynaklar).
- **Profil:** Salt okunur kullanıcı bilgileri ve şifre değiştirme formu.

## 4. İş Kuralları ve Teknik Detaylar
- **Kriterler:** K1'den K8'e kadar 8 standart kriter.
- **Puanlama:** 1-5 arası tam sayı. Başarı eşiği: %70 (40 üzerinden 28 puan).
- **Roller:** `ADMIN` (Tam yetki), `EVALUATOR` (Yalnızca atananları değerlendirme).
- **Güvenlik:** En az 12 karakterli güçlü şifre, HttpOnly cookie, CSRF koruması, yetki kontrolleri.
- **Teknoloji:** React 19, Tailwind 4, tRPC, Drizzle ORM, MySQL.
