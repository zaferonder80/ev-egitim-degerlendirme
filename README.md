# E/V Eğitim İçerik Değerlendirme Sistemi

E/V Eğitim İçerik Değerlendirme Sistemi, eğitim içeriklerinin sekiz kriter üzerinden yapılandırılmış olarak değerlendirilmesi için geliştirilmiş Türkçe bir yönetim uygulamasıdır. Uygulama, yöneticiler için eğitim, kullanıcı, atama, raporlama ve denetim araçlarını; değerlendiriciler için yalnızca kendilerine atanmış içeriklere erişebilen bir çalışma alanını içerir.

## Temel Özellikler

| Alan | Uygulanan yetenekler |
| --- | --- |
| Kimlik doğrulama | E-posta/şifre girişi, bcrypt hashleme, HttpOnly oturum çerezi, sekiz günlük oturum, ilk girişte zorunlu şifre değişikliği |
| Giriş güvenliği | Güçlü parola kuralı, beş hatalı girişte 15 dakika hesap kilidi, IP tabanlı deneme sınırlaması |
| Yetkilendirme | Sunucu tarafı `ADMIN` / `EVALUATOR` RBAC ve değerlendiriciye ait atama sahipliği denetimi |
| Yönetim | Eğitim, sürüm, kullanıcı, rol, hesap durumu, atama, son tarih, arşiv ve denetim kayıtları |
| Değerlendirme | Sekiz kriter, 1–5 puanlama, kriter başına 2.000 karakter yorum, taslak, tamamlama ve yeniden açma |
| Raporlama | Tamamlanmış sonuçlardan çizelge verileri ve Türkçe karakter destekli PDF özet raporu |
| Bildirim | Atama, tamamlama, yeniden açma ve son tarihe üç gün kala uygulama içi bildirim |

## Yerel Geliştirme

```bash
pnpm install
pnpm db:push
pnpm seed:dev
pnpm dev
```

| Komut | Açıklama |
| --- | --- |
| `pnpm dev` | Geliştirme sunucusunu başlatır. |
| `pnpm db:push` | Şema migration’larını üretir ve uygular. |
| `pnpm seed:dev` | Yalnızca geliştirme ortamında demo kullanıcıları, eğitimleri, atamaları ve örnek sonuçları idempotent biçimde yerleştirir. |
| `pnpm check` | TypeScript denetimini çalıştırır. |
| `pnpm test` | Vitest otomatik testlerini çalıştırır. |

> `seed:dev` yalnızca geliştirme ortamında çalışır. Üretimde demo kullanıcı veya değerlendirme verisi üretilmez.

## İlk Yönetici ve E-posta Ayarları

İlk gerçek yönetici hesabı, sistemde henüz hiç `ADMIN` rolü yoksa ilk parola giriş denemesinde oluşturulabilir. Üretim değerlerini uygulamanın gizli ortam değişkenleri alanından yapılandırın; parolaları dosyaya veya kaynak koda yazmayın.

```dotenv
INITIAL_ADMIN_EMAIL=yonetici@kurumunuz.example
INITIAL_ADMIN_PASSWORD=GucluBirIlkSifre!2026

# Opsiyonel e-posta sağlayıcı soyutlaması
EMAIL_PROVIDER=kurumsal_saglayici
EMAIL_FROM=egitim@kurumunuz.example
```

İlk yönetici hesabı parola değiştirme zorunluluğuyla oluşturulur. Parola en az 12 karakter olmalı; büyük/küçük harf, rakam ve özel karakter içermelidir. `EMAIL_PROVIDER` ve `EMAIL_FROM` tanımlanmadığında uygulama içi bildirimler etkilenmez; e-posta servis sınırı dış sağlayıcı bağdaştırıcısı için hazır kalır.

## Puanlama Kuralı

Her tamamlanmış değerlendirme, sekiz kriter için 1–5 arası tam sayı puan içerir. Toplam puan 40 üzerinden hesaplanır. Başarı yüzdesi `toplam puan / 40 × 100` olarak bulunur; **%70 ve üzeri** sonuçlar başarılı kabul edilir. Taslak değerlendirmeler eğitim ve gösterge toplulaştırmalarına dahil edilmez.

## Zamanlanmış Son Tarih Hatırlatması

Uygulama, üç gün sonra sonlanacak tamamlanmamış atamalar için idempotent bir günlük işleyici sunar: `POST /api/scheduled/due-reminders`. İşleyici yalnızca platform zamanlayıcısının cron kimliğiyle çalışır; çağrılar tekrarlandığında aynı gün ve aynı atama için ikinci bildirim üretilmez.

Uygulamayı yayımladıktan sonra proje sahibi aşağıdaki işi bir kez oluşturabilir. Zaman ifadesi UTC’dir.

```bash
manus-heartbeat create \
  --name ev-egitim-due-reminders \
  --cron "0 0 6 * * *" \
  --path /api/scheduled/due-reminders \
  --description "E/V değerlendirmeleri için üç gün kala günlük hatırlatma"
```

> Bu komutu yalnızca uygulama yayımlandıktan sonra çalıştırın. Zamanlayıcı kayıtları platformun yönetim alanından izlenebilir, duraklatılabilir veya silinebilir.

## Güvenlik ve Operasyon Notları

| Konu | Uygulama yaklaşımı |
| --- | --- |
| Oturum | Rastgele belirteç; veri tabanında sadece SHA-256 hash; HttpOnly/Secure/Lax çerez |
| Erişim | Hassas yardımcılar sunucu tarafında RBAC ve kaynak sahipliği denetimi yapar |
| Dosyalar | Eğitim materyali ve görsel dosyaları 10 MB sınırı ile nesne depolamaya alınır; veri tabanında yalnızca URL saklanır |
| Denetim | Yönetici eylemleri denetim kayıtlarına işlenir |
| PDF | Noto Sans Latin Extended yazı tipiyle Türkçe karakterler, sayfa numarası, alt bilgi ve saran yorum metinleri desteklenir |
| Yedekleme | Üretim veritabanı yedekleme ve saklama ilkeleri kurumun veritabanı sağlayıcısı düzeyinde düzenlenmelidir |

## Doğrulama Durumu

Bu proje için TypeScript denetimi ile otomatik testler çalıştırılmıştır. Testler; puan hesaplama, başarı eşiği, geçersiz puanların reddi, güçlü parola denetimi, değerlendircinin admin yordamına erişiminin engellenmesi ve güvenli çıkış çerezi davranışını kapsar.
# ev-egitim-degerlendirme
