# Çevrimdışı Veritabanı Anlık Görüntüsü

## Teslim dosyası

`offline/ev-egitim-degerlendirme-offline-veritabani-anlik-goruntu.html` dosyası, uygulamanın çevrimiçi sürümünü değiştirmeden oluşturulmuş ayrı bir tek-dosyalı pakettir. Dosya haricî JavaScript, CSS, yazı tipi ya da ağ isteği gerektirmez; bilgisayara indirildikten sonra modern bir tarayıcıda çift tıklanarak açılabilir.

## Gömülü veri kapsamı

Paket, dışa aktarma zamanındaki canlı veritabanının **parolasız iş verisi** anlık görüntüsünü içerir. İlk açılışta bu veri, pakete özel tarayıcı yerel depolama alanına kopyalanır. Doğrulanan anlık görüntü; 14 kullanıcı profili, 6 eğitim, 19 atama, 9 değerlendirme, 72 kriter yanıtı, 8 kriter tanımı, 24 uygulama içi bildirim ve 39 denetim kaydını kapsar.

| Veri türü | Çevrimdışı paketteki davranış |
| --- | --- |
| Kullanıcılar ve roller | Yerel kullanıcı listesi ve rol bazlı arayüzde kullanılır. Sunucudaki parola hashleri dışa aktarılmaz. |
| Eğitimler, atamalar ve değerlendirmeler | Mevcut durumlarıyla pakete gömülür; HTML açıldıktan sonra yerelde değiştirilebilir. |
| Kriterler ve değerlendirme yanıtları | Kriter metinleri, puanlar ve yorumlar dahil edilir; gösterge ve rapor hesaplarında kullanılır. |
| Bildirimler ve denetim kayıtları | Anlık görüntüdeki kayıtlar görüntülenir; yeni yerel eylemler tarayıcıdaki kayıtlara eklenir. |

## Yerel kalıcılık ve sıfırlama

Paket `ev-egitim-offline-snapshot-v1` adlı ayrı yerel depolama anahtarını kullanır. Aynı HTML dosyası yeniden açıldığında önceki yerel değişiklikler korunur. Uygulama içindeki **Verileri sıfırla** işlemi, veriyi dosyaya gömülü ilk anlık görüntüye döndürür. Bu nedenle çevrimdışı kullanımdan önce yerel veri yedeğini dışa aktarmak önerilir.

## Doğrulama kaydı

Paket, temiz yerel depolama ile açılarak gömülü anlık görüntünün yüklenmesi ve parolasız rol verilerinin doğru eşlenmesi doğrulandı. Yönetici oturumunda **Ebru’yla Buying** eğitimi Ebru Çelik’e atanmış, dosya yeniden açıldıktan sonra yeni atamanın korunduğu görülmüştür. Toplu atama penceresinde yalnızca Şeyda Gülkokar seçilerek **Bilgi Güvenliği Farkındalığı** eğitimi için tekli atama oluşturulmuş, `1 atama oluşturuldu.` bildirimi alınmış ve sayfa yenilendiğinde kayıt korunmuştur. Bu doğrulama, tekli seçimin toplu atama arayüzüyle geriye dönük uyumlu çalıştığını ve işlem sonucunun yerel depolamaya yazıldığını gösterir. Ebru Çelik ile giriş yapıldığında atama listesi, ilgili eğitim bilgileri ve sekiz kriterli değerlendirme formu erişilebilir durumdadır.

## Güvenlik ve işlevsel sınırlar

> Tek HTML dosyası, çok kullanıcılı bir sunucu uygulamasının güvenlik sınırlarını taşıyamaz. Bu paket taşınabilir çalışma, gösterim ve yerel değerlendirme amaçlıdır.

Sunucu tarafı yetki denetimi, bcrypt parola hashleri, HttpOnly oturum çerezleri, e-posta gönderimi ve zamanlanmış hatırlatmalar tarayıcı içinde çalışmaz. Çevrimdışı kullanımda kullanıcı ve iş verileri, HTML dosyasını açan bilgisayarın tarayıcı depolamasındadır. Gizli ya da çok kullanıcılı üretim operasyonları için çevrimiçi uygulama kullanılmalıdır.
