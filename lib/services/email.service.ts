import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const FROM = `"CrossFit Tracker" <${process.env.SMTP_USER || 'noreply@crossfitapp.ru'}>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export class EmailService {
  /**
   * Отправка письма подтверждения email после регистрации
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${APP_URL}/auth/verify?token=${token}`;

    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: 'Подтвердите ваш email — CrossFit Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #DC2626;">CrossFit Tracker</h2>
          <p>Добро пожаловать! Для завершения регистрации подтвердите ваш email:</p>
          <p style="margin: 24px 0;">
            <a href="${verifyUrl}"
               style="background: #DC2626; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Подтвердить email
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Или скопируйте ссылку:<br/>
            <a href="${verifyUrl}">${verifyUrl}</a>
          </p>
          <p style="color: #999; font-size: 12px;">Ссылка действительна 1 час. Если вы не регистрировались — просто проигнорируйте это письмо.</p>
        </div>
      `,
    });
  }

  /**
   * Отправка письма для сброса пароля
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;

    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: 'Сброс пароля — CrossFit Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #DC2626;">CrossFit Tracker</h2>
          <p>Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы установить новый пароль:</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}"
               style="background: #DC2626; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Сбросить пароль
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Или скопируйте ссылку:<br/>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
          <p style="color: #999; font-size: 12px;">Ссылка действительна 1 час. Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>
        </div>
      `,
    });
  }

  /**
   * Отправка письма подтверждения смены email
   */
  async sendEmailChangeConfirmation(newEmail: string, token: string): Promise<void> {
    const confirmUrl = `${APP_URL}/auth/verify?token=${token}`;

    await transporter.sendMail({
      from: FROM,
      to: newEmail,
      subject: 'Подтверждение нового email — CrossFit Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #DC2626;">CrossFit Tracker</h2>
          <p>Вы запросили изменение email адреса. Подтвердите новый адрес:</p>
          <p style="margin: 24px 0;">
            <a href="${confirmUrl}"
               style="background: #DC2626; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Подтвердить новый email
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Или скопируйте ссылку:<br/>
            <a href="${confirmUrl}">${confirmUrl}</a>
          </p>
          <p style="color: #999; font-size: 12px;">Ссылка действительна 1 час. Если вы не запрашивали смену email — просто проигнорируйте это письмо.</p>
        </div>
      `,
    });
  }
}
