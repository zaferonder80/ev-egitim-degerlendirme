export type EvaluationSetTemplate = {
  name: string;
  description: string;
  rubricScale: Record<string, string>;
  passingScore: number;
  criteria: Array<{
    name: string;
    weight: number;
  }>;
};

export const DEFAULT_EVALUATION_SETS: EvaluationSetTemplate[] = [
  {
    name: "E-eğitim Değerlendirme",
    description: "Eğitim içeriğini kapsamlı şekilde değerlendiren kurumsal e-eğitim ölçüm seti.",
    passingScore: 70,
    rubricScale: {
      "1": "Uygun değil",
      "2": "Gelişmesi gerekli",
      "3": "Kısmen uygun",
      "4": "Uygun",
      "5": "Mükemmel",
    },
    criteria: [
      { name: "Amaç ve hedeflerin netliği", weight: 12.5 },
      { name: "İçeriğin doğruluğu, güncelliği ve hedef kitleye uygunluğu", weight: 12.5 },
      { name: "İçeriğin farklı öğrenme stillerine uygunluğu", weight: 12.5 },
      { name: "Eğitim içerik hiyerarşisinin uygunluğu", weight: 12.5 },
      { name: "Eğitimde verilen örneklerin, alıştırmaların ve etkileşimlerin yeterliliği ve etkililiği", weight: 12.5 },
      { name: "İçeriğin bilgi yoğunluğu ile toplam eğitim süresinin uygunluğu", weight: 12.5 },
      { name: "Video, ses, montaj ve görsellerin kalitesi", weight: 12.5 },
      { name: "Ölçme ve değerlendirme aracının eğitim içeriğine ve hedef kitleye uygunluğu", weight: 12.5 },
    ],
  },
  {
    name: "Senaryo Değerlendirme",
    description: "Senaryo tabanlı görev ve performans çıktılarının değerlendirilmesine yönelik set.",
    passingScore: 70,
    rubricScale: {
      "1": "Uygun değil",
      "2": "Gelişmesi gerekli",
      "3": "Kısmen uygun",
      "4": "Uygun",
      "5": "Mükemmel",
    },
    criteria: [
      { name: "İçerik uyumu", weight: 20 },
      { name: "Senaryo gerçekçiliği", weight: 20 },
      { name: "Yapılandırma ve akış", weight: 20 },
      { name: "Uygulama başarısı", weight: 20 },
      { name: "Değerlendirme ve geri bildirim kalitesi", weight: 20 },
    ],
  },
];
