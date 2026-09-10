# E/V Eğitim Değerlendirme — Tek Dosyalı Çevrimdışı Sürüm

## Kullanım

`offline/ev-egitim-degerlendirme-offline.html` dosyasını yerel diske indirin ve modern bir masaüstü tarayıcısında doğrudan açın. Haricî CDN, API, font veya sunucu isteği kullanmadığından uygulama ağ bağlantısı olmadan çalışır. İlk açılışta demo veri kümesi ve aşağıdaki hesaplar gelir: `admin.demo@ev.local`, `ayse.demir@ev.local`, `berk.kaya@ev.local` ve `deniz.aras@ev.local`. Başlangıç parolası `Demo!2026Egitim` değeridir.

## Korunan yerel iş akışları

Uygulama, yönetici ve değerlendirici için ayrı arayüzler sunar. Yönetici eğitim ekleyebilir, düzenleyebilir ve arşivleyebilir; yerel kullanıcıları yönetebilir; değerlendirici atayabilir; raporları yazdırma iletişim kutusu üzerinden PDF olarak kaydedebilir; denetim kayıtlarını görüntüleyebilir. Değerlendirici atanan eğitim için yönetici tarafından girilen bilgileri görür, sekiz kriteri puanlar, kriter bazlı yorum ekler, taslak kaydeder veya değerlendirmeyi tamamlar. Profil alanı salt okunurdur; yalnızca parola değiştirme mümkündür. Son teslim tarihi yaklaşan yerel atamalar uygulama içi bildirim olarak görünür.

Tüm değişiklikler tarayıcının `LocalStorage` alanında saklanır. Bu nedenle eğitimler, atamalar, taslaklar, değerlendirmeler, bildirimler, denetim kayıtları ve kullanıcı değişiklikleri aynı tarayıcıda sayfa yeniden açıldığında korunur. **Veriyi dışa aktar** ve **Veriyi içe aktar** seçenekleri, yerel JSON yedeği üzerinden taşınabilirlik sağlar.

## Toplu ve tekli değerlendirici atama

Yönetici, **Atamalar** ekranındaki **Değerlendirici ata** işleminde bir veya daha fazla değerlendiriciyi onay kutularıyla seçer. Tek bir kişi seçildiğinde akış, önceki tekli atama davranışını korur ve başarılı işlem sonunda `1 atama oluşturuldu.` bildirimi gösterir. Birden fazla kişi seçildiğinde her seçili kişi için atama aynı işlemde oluşturulur. Seçili eğitim–değerlendirici çifti zaten varsa yeni kayıt açılmaz; sonuç bildiriminde atlanan mükerrer kayıt sayısı belirtilir.

Atama oluşturma işlemi, eğitim, atama ve denetim kaydı değişikliğini aynı yerel veri kümesine kaydeder. Bu nedenle sayfa kapatılıp aynı dosya tekrar açıldığında oluşturulan tekli veya toplu atamalar korunur.

## Doğrulama notu

Dosya doğrudan `file://` adresinden açılarak internet bağımsızlığı kontrol edildi. Yönetici ve Ayşe Aktar demo hesabıyla rol bazlı giriş doğrulandı. Ayşe Aktar için sekiz kriterden oluşan form dolduruldu, taslak kaydedildi, değerlendirme tamamlandı ve uygulama yeniden yüklendi; durum ile yorumların yerel depolamadan korunduğu doğrulandı. Yönetici olarak eğitim oluşturma, düzenleme ve arşivleme; atama oluşturma, mükerrer atama engeli ve atama kaldırma akışları da çalıştırıldı. Toplu atama penceresinde yalnızca Şeyda Gülkokar seçilerek Bilgi Güvenliği Farkındalığı eğitimine atama oluşturuldu; `1 atama oluşturuldu.` bildirimi alındı ve sayfa yenilendiğinde atama listede korunuyordu. Rapor işlevinin oluşturduğu ayrı yazdırma belgesi, tamamlanmış bir değerlendirme üzerinde doğrulandı: rapor başlığını ve sekiz kriterin tamamını içeren 1.987 karakterlik bağımsız HTML üretildi; ardından tarayıcının yazdırma çağrısı planlandı. Tarayıcı konsolunda bu akışlar sırasında hata gözlenmedi.

## Zorunlu sınırlar

Tek bir HTML dosyası sunucu, veritabanı ve gizli anahtar barındıramaz. Bu nedenle mevcut çevrimiçi uygulamanın **sunucu tarafı RBAC güvenliği, bcrypt parola hashleme, HttpOnly çerez oturumu, hesap kilitleme, çok kullanıcılı eşzamanlılık, gerçek e-posta gönderimi ve arka planda çalışan zamanlanmış hatırlatmaları** çevrimdışı sürümde teknik olarak sağlanamaz. Rol kontrolleri yalnızca arayüz seviyesindedir; cihazı kullanabilen kişi tarayıcı verisini değiştirebilir. Bu sürüm eğitim, demo, tek cihazlı çalışma ve internet bağlantısının olmadığı kontrollü ortamlar için uygundur; hassas kurumsal kullanımda sunucu tabanlı sürüm kullanılmalıdır.
