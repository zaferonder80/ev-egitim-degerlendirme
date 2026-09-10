# E/V Eğitim İçerik Değerlendirme Sistemi

## Mimari Plan

Uygulama, React ve TypeScript istemcisi; Express üzerinde çalışan tRPC sunucusu; Drizzle ORM ve ilişkisel MySQL/TiDB veritabanı ile oluşturulacaktır. İstemci, yalnızca tip güvenli tRPC çağrıları üzerinden sunucuya erişecektir. Tüm kritik kurallar (rol denetimi, atama sahipliği, puan aralığı, tekrar atamayı engelleme, değerlendirme kilidi ve hesaplamalar) sunucu tarafında uygulanacaktır. Dosya ve görsel içerikleri veri tabanına değil, nesne depolamaya konacak; veri tabanında yalnızca doğrulanmış dosya URL'si ve meta verileri tutulacaktır.

Parola tabanlı uygulama oturumu, güvenli rastgele oturum belirteci ile desteklenecek, belirteç hashlenerek veri tabanında saklanacak ve tarayıcıya **HttpOnly**, **Secure** ve **SameSite=Lax** çerezi olarak verilecektir. Kimlik doğrulama için bcrypt hashleme, parola karmaşıklığı, başarısız giriş sayacı ve geçici hesap kilidi kullanılacaktır. Kullanıcıların platform kimliği ile uygulamanın e-posta/şifre hesabı birbirinden ayrılır; bu uygulamada yetkilendirme, uygulama kullanıcısının rol ve aktiflik bilgisinden türetilir.

## Yetki Matrisi

| İşlem | Admin | Değerlendirici | Sunucu denetimi |
| --- | --- | --- | --- |
| Gösterge ve tüm raporları görüntüleme | Evet | Hayır | `ADMIN` rolü |
| Eğitim oluşturma, güncelleme, arşivleme | Evet | Hayır | `ADMIN` rolü |
| Kullanıcı ve atama yönetimi | Evet | Hayır | `ADMIN` rolü |
| Kendisine atanmış eğitimi görme | Evet | Evet | Atama `evaluatorId` sahipliği |
| Taslak kaydetme ve değerlendirme tamamlama | Yeniden açma dışında hayır | Evet | Atama sahipliği ve durum kontrolü |
| Tamamlanmış değerlendirmeyi yeniden açma | Evet | Hayır | `ADMIN` rolü ve denetim kaydı |
| Diğer değerlendiricilerin yorumlarını görme | Evet | Hayır | Rol ve kaynak kapsamı |

## İlişkisel Veri Modeli

| Tablo | Ana alanlar | İlişkiler ve kurallar |
| --- | --- | --- |
| `users` | ad, soyad, e-posta, `passwordHash`, rol, aktiflik, parola/kilit alanları | E-posta benzersizdir; rol `ADMIN` veya `EVALUATOR` olur. |
| `sessions` | kullanıcı, token hash, bitiş, ip, kullanıcı aracısı | Oturum tokenı düz metin saklanmaz. |
| `trainings` | kod, başlık, künye, URL'ler, sürüm, tarihler, durum | Eğitim kodu benzersizdir; durum `DRAFT`, `ACTIVE`, `ARCHIVED` olur. |
| `assignments` | eğitim, değerlendirici, atayan, son tarih, durum | `trainingId` + `evaluatorId` benzersizdir; pasif kullanıcıya veya arşivlenmiş eğitime atama yapılamaz. |
| `evaluations` | atama, genel yorum, toplam/ortalama/yüzde, sonuç, gönderim | Her atama için en fazla bir değerlendirme bulunur; taslak toplulaştırmaya girmez. |
| `evaluationResponses` | değerlendirme, kriter, puan, yorum | Değerlendirme + kriter benzersizdir; puan yalnızca 1–5 olur. |
| `criteria` | sıra, ad, açıklama, kontrol noktaları | Başlangıçta sekiz aktif kriter tanımlanır. |
| `notifications` | kullanıcı, tür, başlık, içerik, okundu, ilişki kimliği | Atama, hatırlatma, tamamlama ve yeniden açma olayları kaydedilir. |
| `auditLogs` | kullanıcı, eylem, varlık, eski/yeni değer, IP | Yönetimsel değişiklikler ve PDF üretimi izlenebilir olur. |

## Hesaplama Kuralı

Her tamamlanmış değerlendirmede toplam puan sekiz kriterin toplamıdır. Ortalama puan `toplam / 8`, başarı yüzdesi `toplam / 40 × 100` formülüyle hesaplanır. Yüzde **70 veya üzeri** sonuçlar başarılıdır. Eğitim düzeyindeki göstergeler yalnızca tamamlanmış değerlendirmelerin aritmetik ortalamasından türetilir; taslaklar her zaman hariç tutulur. Hesaplamalar yuvarlanmamış değer üzerinde yapılır ve yalnızca gösterimde iki ondalık basamağa yuvarlanır.

## Bildirim ve Zamanlama Notu

Atama, tamamlama ve yeniden açma bildirimleri işlem anında oluşturulacaktır. Son tarihe üç gün kala hatırlatma için uygulama, güvenli bir zamanlanmış uç nokta hazırlayacaktır. Bu uç nokta, yayımlanmış ortamda platformun kalıcı zamanlayıcısı ile etkinleştirilir; uygulama içi zamanlayıcı kullanılmaz. E-posta gönderimi isteğe bağlı yapılandırılan bir servis arayüzü olarak tasarlanır; yapılandırma yoksa uygulama içi bildirimler devam eder.

