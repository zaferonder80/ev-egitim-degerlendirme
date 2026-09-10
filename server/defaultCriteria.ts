export type DefaultCriterion = {
  name: string;
  description: string | null;
  controlPoints: string[];
};

export const DEFAULT_CRITERIA: DefaultCriterion[] = [
  {
    name: "Amaç ve hedeflerin netliği",
    description:
      "Eğitim künyesinin tam olması ve eğitimde açıklanması beklenir.",
    controlPoints: [
      "Eğitim adı, hedef kitle, süre ve öğrenme hedefleri mevcut mu?",
      "Amaç ve kazanımlar açık şekilde ifade edilmiş mi?",
      "Katılımcının eğitim sonunda ne kazanacağı net mi?",
    ],
  },
  {
    name: "İçeriğin doğruluğu, güncelliği ve hedef kitleye uygunluğu",
    description:
      "İçeriğin doğruluğu, güncelliği ve hedef kitleye uygunluğu değerlendirilir.",
    controlPoints: [
      "İçerik doğru mu?",
      "İçerik güncel mi?",
      "Hedef kitlenin bilgi ve deneyim seviyesine uygun mu?",
      "Kullanılan dil ve terminoloji uygun mu?",
    ],
  },
  {
    name: "İçeriğin farklı öğrenme stillerine uygunluğu",
    description:
      "İçeriğin işitsel, görsel ve etkileşimli öğrenme tercihlerini destekleme seviyesi değerlendirilir.",
    controlPoints: [
      "Görsel destekler yeterli mi?",
      "İşitsel içerikler uygun mu?",
      "Etkileşimli öğrenme unsurları var mı?",
      "Farklı öğrenme tercihleri dengeli biçimde destekleniyor mu?",
    ],
  },
  {
    name: "Eğitim içerik hiyerarşisinin uygunluğu",
    description:
      "İçeriğin basitten karmaşığa doğru tasarlanması beklenir.",
    controlPoints: [
      "İçerik basitten karmaşığa ilerliyor mu?",
      "Konular arasında mantıksal akış var mı?",
      "Başlık ve alt başlık yapısı anlaşılır mı?",
      "Bölümler arasındaki geçişler öğrenmeyi destekliyor mu?",
    ],
  },
  {
    name: "Eğitimde verilen örneklerin, alıştırmaların ve etkileşimlerin yeterliliği ve etkililiği",
    description: null,
    controlPoints: [
      "Örnekler gerçek iş yaşamıyla bağlantılı mı?",
      "Alıştırmalar öğrenmeyi pekiştiriyor mu?",
      "Etkileşimler katılımcıyı aktif tutuyor mu?",
      "Yeterli uygulama fırsatı bulunuyor mu?",
    ],
  },
  {
    name: "İçeriğin bilgi yoğunluğu ile toplam eğitim süresinin uygunluğu",
    description:
      "Uzun eğitimlerin micro-learning yaklaşımıyla bölümlenmesi dikkate alınır.",
    controlPoints: [
      "İçerik yoğunluğu ve süre dengeli mi?",
      "Bilişsel yük uygun seviyede mi?",
      "Uzun içerikler anlamlı küçük bölümlere ayrılmış mı?",
      "Micro-learning yaklaşımına uygun mu?",
    ],
  },
  {
    name: "Video, ses, montaj ve görsellerin kalitesi",
    description: null,
    controlPoints: [
      "Video görüntü kalitesi yeterli mi?",
      "Ses seviyesi ve ses temizliği uygun mu?",
      "Montaj profesyonel ve akıcı mı?",
      "Görseller anlaşılır ve kaliteli mi?",
      "Görsel tasarım dili tutarlı mı?",
      "Medya unsurları öğrenmeyi destekliyor mu?",
    ],
  },
  {
    name: "Ölçme ve değerlendirme aracının eğitim içeriğine ve hedef kitleye uygunluğu",
    description: null,
    controlPoints: [
      "Ölçme aracı öğrenme hedefleriyle uyumlu mu?",
      "Sorular eğitim içeriğini kapsıyor mu?",
      "Sorular hedef kitleye uygun mu?",
      "Yalnızca bilgiyi hatırlamayı değil, uygulamayı da ölçüyor mu?",
      "Katılımcıya anlamlı geri bildirim veriliyor mu?",
    ],
  },
];
