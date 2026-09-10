export type EmailMessage = { to: string; subject: string; text: string };
export type EmailDeliveryResult = { delivered: boolean; reason?: string };

/**
 * E-posta sağlayıcısı için değiştirilebilir servis sınırı. E-posta ortam
 * değişkenleri yapılandırılmadığında iş kuralları yalnızca uygulama içi
 * bildirim ile devam eder; hiçbir kullanıcı verisi dış servise gönderilmez.
 */
export const emailService = {
  isConfigured() {
    return Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_FROM);
  },
  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.isConfigured()) return { delivered: false, reason: "E-posta sağlayıcısı yapılandırılmadı." };
    // Sağlayıcı bağdaştırıcısı, örneğin SMTP veya kurumsal API, yalnızca ortam
    // değişkenleri üzerinden eklenecek şekilde bu sınırda uygulanmalıdır.
    console.info("[Email] Yapılandırılmış e-posta sağlayıcısı için teslim kuyruğa alındı", { to: message.to, subject: message.subject });
    return { delivered: false, reason: "Sağlayıcı bağdaştırıcısı tanımlanmadı." };
  },
};
