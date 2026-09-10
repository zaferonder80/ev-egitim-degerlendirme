# Project TODO

- [x] Mimari plan, veri modeli ve güvenlik kararlarını dokümante et
- [x] Veritabanı şeması, migration ve seed verilerini oluştur
- [x] E-posta/şifre kimlik doğrulaması, güçlü parola, HttpOnly oturum ve hesap kilidi
- [x] Admin/değerlendirici RBAC ve atama sahipliği kontrolleri
- [x] Admin dashboard, eğitim, kullanıcı, atama ve denetim ekranları
- [x] Değerlendirici atama listesi ve sekiz kriterli değerlendirme akışı
- [x] Eğitim dosyası/görseli için nesne depolama yükleme akışı
- [x] PDF rapor üretimi, Türkçe font, güvenli admin endpoint ve Blob indirme akışı
- [x] Uygulama içi bildirim ve üç gün kala hatırlatma altyapısı
- [x] Admin giriş sonrası gömülü ön izleme oturum geri dönüşü
- [x] Yeni eğitim rota ve React hook sırası hatası düzeltmesi
- [x] Değerlendirici değerlendirme ekranına Eğitim Bilgileri sekmesi
- [x] Eğitim Bilgileri sekmesinde admin tarafından girilen tüm eğitim alanları
- [x] Eğitim bilgi verisinin değerlendirici atama sahipliği kontrolüyle sunulması
- [x] TypeScript denetimi, üretim derlemesi ve 7 mevcut Vitest testi
- [x] Admin oturumuyla PDF endpoint uçtan uca doğrulaması: PDF 1.3, 9 sayfa, 20.418 byte
- [x] Son düzeltme checkpoint’ini oluştur

## Kabul Kriterleri

- [x] Admin rapor PDF’si geçerli ve indirilebilir.
- [x] PDF Türkçe karakterleri, sayfa numarasını, alt bilgiyi ve saran uzun yorumları korur.
- [x] Değerlendirici yalnızca kendisine atanmış eğitimin bilgilerini görebilir.
- [x] Admin tarafından girilen künye, açıklama, hedef kitle, öğrenme amaçları, süre, sorumlu, bağlantı, dosya/görsel, sürüm ve tarih alanları ayrı sekmede görünür.
- [x] TypeScript ve Vitest testleri başarılıdır.
- [x] Yeni checkpoint oluşturulmalıdır.

## Aktif İstek Sırası

1. PDF indirme sorunu çözüldü ve admin oturumuyla doğrulandı.
2. Değerlendirici Atamalarım içinden açılan değerlendirmeye Eğitim Bilgileri sekmesi eklendi.
3. Admin dashboard yetkilendirme düzeltmesi doğrulanmış ve checkpoint’e hazırdır.

## Son Teknik Kayıt

PDF’nin 500 hatasının kök nedeni, üretimde mevcut olmayan `@fontsource/noto-sans` dosya yoluydu. Taşınabilir DejaVu Sans fontları `server/assets/` altına eklendi ve üretim derleme betiği bunları `dist/assets/` içine kopyalayacak şekilde güncellendi. Admin PDF isteği artık `200 application/pdf` döndürmektedir.

- [x] Değerlendirici değerlendirme ekranında görünen yanlış "Bir değerlendirici bu eğitime zaten atanmış" hatasını düzelt
- [x] Aynı atamanın tekrar gönderilmesini idempotent biçimde ele al, TypeScript/Vitest denetiminden geçir ve admin atama çağrısını doğrula
- [x] Admin dashboard sorgusunda eski ön izleme oturum belirtecinin admin sorgularını FORBIDDEN yapmasına neden olan uyumsuzluğu düzelt
- [x] Admin dashboard erişimini yeni admin oturum belirteciyle gerçek HTTP sorgusunda doğrula; mevcut RBAC testi değerlendirici erişimini engellemeyi kapsar
- [x] PDF raporunda dördüncü sayfadan itibaren oluşan boş sayfaların sayfalama nedenini gider
- [x] Tüm değerlendirme yorumlarını kriter bazında PDF raporunun sonuna ekle
- [x] Güncellenen PDF’i gerçek admin oturumunda doğrula: HTTP 200, 4 sayfa, 4 alt bilgi, kriter bazlı yorum bölümü ve 9 değerlendirici adı kaydı
- [x] Sol alt kullanıcı adı bağlantısını salt okunur kullanıcı profili ekranına yönlendir
- [x] Profil ekranında ad, soyad, e-posta, rol, hesap durumu ve son giriş bilgisini değiştirilemez göster
- [x] Profil ekranında yalnızca mevcut şifre doğrulamalı güvenli şifre değiştirme işlemini sun
- [x] Admin profil ekranını gerçek oturumda doğrula: sol alt kullanıcı bağlantısı, salt okunur alanlar ve mevcut şifre doğrulamalı şifre değiştirme formu görüntüleniyor
- [x] Değerlendirici profil ekranını gerçek demo oturumunda doğrula: salt okunur kullanıcı alanları ve yalnızca şifre değiştirme formu doğru görünüyor
- [x] Giriş başarılı bildirimi sonrasında rol bazlı çalışma alanına yönlendirme yapılmaması hatasını teşhis et ve düzelt; yeni oturumla tam sayfa yönlendirmesi admin ve değerlendirici hesaplarında doğrulandı
- [x] Eğitim değerlendirme sisteminin tek HTML dosyasında çevrimdışı çalışan taşınabilir sürümünü oluştur
- [x] Çevrimdışı sürümde yerel veri kalıcılığı, rol bazlı arayüz, eğitim yönetimi, atama ve sekiz kriterli değerlendirme akışını doğrula
- [x] Çevrimdışı sürümün çok kullanıcılı sunucu güvenliği, e-posta gönderimi ve zamanlanmış bildirimler için sınırlarını belgeleyerek teslim et
- [x] Çevrimdışı HTML sürümünde admin olarak eğitim oluşturma, düzenleme ve arşivleme akışlarını `file://` üzerinden uçtan uca doğrula
- [x] Çevrimdışı HTML sürümünde admin atama oluşturma ve kaldırma akışlarını doğrula; mükerrer atama engelini test et
- [x] Çevrimdışı HTML sürümünde sekiz kriterli değerlendirmeyi tamamlayarak durumun tamamlandı hâline geçtiğini, rapor erişimini ve sayfa yenileme sonrası kalıcılığı doğrula
- [x] Çevrimdışı HTML sürümünde PDF aç akışının yazdırılabilir rapor içeriğini ürettiğini doğrula ve doğrulama belgesine kaydet
- [x] Görüntüdeki on kişiyi EVALUATOR rolüyle çevrimiçi varsayılan kullanıcı veri setine ekle
- [x] Yeni değerlendiricileri güçlü başlangıç parolasıyla mevcut canlı kullanıcı listesine idempotent biçimde ekle
- [x] Yeni değerlendiricileri tek dosyalı çevrimdışı sürümün varsayılan kullanıcı veri setine ekle
- [x] Eklenen kullanıcıları listede ve örnek giriş akışında doğrula
- [x] Genel Bakış kriter puan grafiğinde sütun üzerine gelindiğinde ilgili kriter metnini göster
- [x] Genel Bakış kriter puan grafiğinin altında K1–K8 kriter açıklamalarını kalıcı olarak listele
- [x] Kriter grafik açıklamalarını masaüstü ve mobil görünümde doğrula
- [x] Mevcut canlı veritabanının güncel anlık görüntüsünü çevrimdışı paket için dışa aktar
- [x] Uygulamayı değiştirmeden, anlık görüntüyü taşıyan ayrı tek HTML çevrimdışı paketi oluştur
- [x] Paket içinde yerel veri kalıcılığını ve temel rol bazlı iş akışlarını güncel verilerle doğrula
- [x] Veritabanı anlık görüntüsünün güvenlik, e-posta ve zamanlanmış iş sınırlarını belgeleyerek teslim et
- [x] Veritabanı anlık görüntülü HTML paketinde bir yerel değişiklik yapıp sayfa yeniden açıldıktan sonra verinin korunduğunu doğrula
- [x] Veritabanı anlık görüntülü HTML paketinde admin ve değerlendirici için en az birer temel iş akışını uçtan uca doğrula ve sonucu belgeye ekle
- [x] Çevrimdışı HTML atama ekranına birden fazla değerlendirici seçimi ekle
- [x] Seçilen değerlendiricilere tek işlemde atama oluştur; mükerrer atamaları atlayarak sonucu kullanıcıya bildir
- [x] Toplu atama işleminde yerel veri kalıcılığını ve mevcut tekli atama uyumluluğunu doğrula
- [x] Daha önce iletilen değerlendirici kullanıcı listesini çevrimdışı HTML dosyasının gömülü başlangıç verisine ekle
- [x] Gömülü kullanıcı listesinin temiz çevrimdışı başlangıçta yüklendiğini ve hesaplarla giriş yapılabildiğini doğrula
- [x] Çevrimdışı HTML sürümünde toplu atama arayüzünde yalnızca tek değerlendirici seçerek atama oluşturmayı uçtan uca doğrula ve mevcut tekli atama uyumluluğunu belgeye/teste ekle
- [x] Çevrimdışı toplu atama ile oluşturulan atamaların her iki HTML paketinde sayfa yeniden açıldıktan sonra korunduğunu doğrula ve sonucu belgeye ekle
- [x] Tek değerlendirici seçimiyle atama oluşturma uyumluluğunu `offlineBulkAssignment.test.ts` içinde otomatik testle kapsa
- [x] Tekli atama uyumluluğu doğrulamasını ilgili çevrimdışı kullanım belgesine açıkça ekle
