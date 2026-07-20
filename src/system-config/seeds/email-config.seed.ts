import { EmailTemplateConfig } from '../entities/email-template-config.entity';
import { SystemConfig } from '../entities/system-config.entity';

export const EMAIL_SMTP_SEEDS: Pick<
  SystemConfig,
  'group' | 'key' | 'value' | 'description'
>[] = [
  {
    group: 'email_smtp',
    key: 'enabled',
    value: 'false',
    description: 'Enable/disable email sending',
  },
  {
    group: 'email_smtp',
    key: 'host',
    value: 'smtp.gmail.com',
    description: 'SMTP server host',
  },
  {
    group: 'email_smtp',
    key: 'port',
    value: '587',
    description: 'SMTP server port',
  },
  { group: 'email_smtp', key: 'user', value: '', description: 'SMTP username' },
  { group: 'email_smtp', key: 'pass', value: '', description: 'SMTP password' },
  {
    group: 'email_smtp',
    key: 'secure',
    value: 'false',
    description: 'Use SSL/TLS',
  },
  {
    group: 'email_smtp',
    key: 'requireTls',
    value: 'true',
    description: 'Require STARTTLS when using a non-TLS socket',
  },
  {
    group: 'email_smtp',
    key: 'fromName',
    value: 'Voting Suite',
    description: 'Sender name',
  },
  {
    group: 'email_smtp',
    key: 'fromEmail',
    value: 'no-reply@votingsuite.com',
    description: 'Sender email',
  },
];

export const EMAIL_REDIS_SEEDS: Pick<
  SystemConfig,
  'group' | 'key' | 'value' | 'description'
>[] = [
  {
    group: 'email_redis',
    key: 'host',
    value: process.env.EMAIL_REDIS_HOST || 'localhost',
    description: 'Redis host for email queue',
  },
  {
    group: 'email_redis',
    key: 'port',
    value: process.env.EMAIL_REDIS_PORT || '6379',
    description: 'Redis port',
  },
  {
    group: 'email_redis',
    key: 'password',
    value: process.env.EMAIL_REDIS_PASSWORD || '',
    description: 'Redis password (empty if none)',
  },
];

type TemplateSeed = Pick<EmailTemplateConfig, 'name' | 'subject' | 'htmlBody'>;

interface EmailLayoutOptions {
  eyebrow: string;
  title: string;
  content: string;
  accent?: string;
  footer?: string;
}

const detailRow = (label: string, value: string): string => `
  <tr>
    <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 42%;">${label}</td>
    <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; color: #0f2747; font-weight: 600;">${value}</td>
  </tr>`;

const emailLayout = ({
  eyebrow,
  title,
  content,
  accent = '#155eef',
  footer = 'Este mensaje fue generado automáticamente. No compartas códigos ni enlaces personales.',
}: EmailLayoutOptions): string => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin: 0; background: #f1f5f9; font-family: Arial, Helvetica, sans-serif; color: #0f2747;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${eyebrow}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 28px 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; background: #ffffff; border: 1px solid #dbe4ef; border-radius: 14px; overflow: hidden;">
          <tr>
            <td style="padding: 22px 30px; background: #082c54; color: #ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 36px; height: 36px; border-radius: 10px; background: #155eef; text-align: center; font-weight: 700;">VS</td>
                  <td style="padding-left: 12px; font-size: 18px; font-weight: 700;">Voting Suite</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 30px 12px;">
              <div style="color: ${accent}; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;">${eyebrow}</div>
              <h1 style="margin: 9px 0 0; color: #071b35; font-size: 26px; line-height: 1.25;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 30px 32px; font-size: 15px; line-height: 1.65;">${content}</td>
          </tr>
          <tr>
            <td style="padding: 18px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; line-height: 1.5;">${footer}<br>Voting Suite · Plataforma de gestión electoral</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const codePanel = (code: string, accent = '#155eef'): string => `
  <div style="margin: 24px 0; padding: 22px; border: 1px solid #dbe4ef; border-radius: 12px; background: #f8fafc; text-align: center;">
    <div style="font-size: 32px; line-height: 1; letter-spacing: 7px; color: ${accent}; font-weight: 700;">${code}</div>
  </div>`;

const button = (label: string, href: string): string => `
  <div style="margin: 26px 0; text-align: center;">
    <a href="${href}" style="display: inline-block; padding: 13px 24px; border-radius: 8px; background: #155eef; color: #ffffff; font-weight: 700; text-decoration: none;">${label}</a>
  </div>`;

export const EMAIL_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    name: 'verification-code',
    subject: 'Verifica tu cuenta en Voting Suite',
    htmlBody: emailLayout({
      eyebrow: 'Verificación de cuenta',
      title: 'Confirma tu correo electrónico',
      content: `
        <p style="margin: 0;">Usa este código para completar la creación o verificación de tu cuenta:</p>
        ${codePanel('{{code}}')}
        <p style="margin: 0;">El código vence en <strong>{{expiresIn}} minutos</strong>.</p>
        <p style="margin: 16px 0 0; color: #64748b;">Si no realizaste esta solicitud, puedes ignorar el mensaje.</p>`,
    }),
  },
  {
    name: 'password-reset',
    subject: 'Código para restablecer tu contraseña',
    htmlBody: emailLayout({
      eyebrow: 'Seguridad de la cuenta',
      title: 'Restablece tu contraseña',
      accent: '#b42318',
      content: `
        <p style="margin: 0;">Recibimos una solicitud para cambiar la contraseña de tu cuenta. Introduce este código en Voting Suite:</p>
        ${codePanel('{{code}}', '#b42318')}
        <p style="margin: 0;">El código vence en <strong>{{expiresIn}} minutos</strong>.</p>
        <p style="margin: 16px 0 0; color: #64748b;">Si no solicitaste el cambio, ignora este correo y conserva tus credenciales.</p>`,
    }),
  },
  {
    name: 'voter-access-code',
    subject: 'Código temporal para acceder a {{electionTitle}}',
    htmlBody: emailLayout({
      eyebrow: 'Acceso al portal de votación',
      title: 'Tu código temporal de acceso',
      accent: '#087f5b',
      content: `
        <p style="margin: 0;">Solicitaste acceso a la elección <strong>{{electionTitle}}</strong>.</p>
        ${codePanel('{{code}}', '#087f5b')}
        <p style="margin: 0;">El código vence en <strong>{{expiresIn}} minutos</strong>{{#if singleUse}} y solo puede utilizarse una vez{{/if}}.</p>
        <p style="margin: 16px 0 0; color: #64748b;">Este código es personal. No lo compartas con otras personas.</p>`,
    }),
  },
  {
    name: 'voter-invitation',
    subject: 'Invitación para participar en {{electionTitle}}',
    htmlBody: emailLayout({
      eyebrow: 'Invitación electoral',
      title: 'Has sido incluido en el padrón',
      accent: '#087f5b',
      content: `
        <p style="margin: 0;">Puedes participar en la elección <strong>{{electionTitle}}</strong>.</p>
        ${button('Ir al portal de votación', '{{portalUrl}}')}
        <p style="margin: 0; color: #64748b;">El acceso es personal. Verifica siempre que el enlace corresponda al portal oficial de tu organización.</p>`,
    }),
  },
  {
    name: 'voter-custom-invitation',
    subject: '{{title}}',
    htmlBody: emailLayout({
      eyebrow: 'Invitación electoral',
      title: '{{title}}',
      accent: '#087f5b',
      content: '{{{content}}}',
    }),
  },
  {
    name: 'voter-reminder',
    subject: '{{title}}',
    htmlBody: emailLayout({
      eyebrow: 'Recordatorio electoral',
      title: '{{title}}',
      accent: '#b54708',
      content: '{{{content}}}',
    }),
  },
  {
    name: 'gdpr-dpo-notification',
    subject: '[GDPR] Brecha {{severity}}: {{type}}',
    htmlBody: emailLayout({
      eyebrow: 'Alerta interna de protección de datos',
      title: 'Se detectó una brecha de seguridad',
      accent: '#b42318',
      content: `
        <p style="margin: 0 0 18px;">El sistema registró un incidente que requiere revisión del responsable de protección de datos.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 10px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
          ${detailRow('Identificador', '{{breachId}}')}
          ${detailRow('Tipo', '{{type}}')}
          ${detailRow('Severidad', '{{severity}}')}
          ${detailRow('Personas afectadas', '{{affectedUsers}}')}
          ${detailRow('Categorías de datos', '{{dataCategories}}')}
          ${detailRow('Detectada', '{{detectedAt}}')}
          ${detailRow('Notificar autoridad', '{{authorityNotification}}')}
          ${detailRow('Notificar personas', '{{subjectNotification}}')}
        </table>
        <h2 style="margin: 24px 0 8px; font-size: 17px;">Descripción registrada</h2>
        <p style="margin: 0;">{{description}}</p>`,
      footer: 'Aviso interno dirigido al responsable de protección de datos.',
    }),
  },
  {
    name: 'gdpr-authority-notification',
    subject: '[GDPR Art. 33] Notificación de brecha: {{type}}',
    htmlBody: emailLayout({
      eyebrow: 'Notificación a la autoridad de control',
      title: 'Brecha de datos personales · Artículo 33',
      accent: '#b42318',
      content: `
        <p style="margin: 0 0 18px;">A la atención de <strong>{{authorityName}}</strong>:</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 10px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
          ${detailRow('Identificador', '{{breachId}}')}
          ${detailRow('Tipo', '{{type}}')}
          ${detailRow('Severidad', '{{severity}}')}
          ${detailRow('Personas afectadas', '{{affectedUsers}}')}
          ${detailRow('Categorías de datos', '{{dataCategories}}')}
          ${detailRow('Fecha de detección', '{{detectedAt}}')}
          ${detailRow('Fecha de notificación', '{{notifiedAt}}')}
        </table>
        <h2 style="margin: 24px 0 8px; font-size: 17px;">Naturaleza del incidente</h2>
        <p style="margin: 0;">{{description}}</p>
        <p style="margin: 18px 0 0;">Contacto del responsable de protección de datos: <a href="mailto:{{dpoEmail}}" style="color: #155eef;">{{dpoEmail}}</a></p>`,
      footer:
        'Notificación generada desde el registro de brechas de Voting Suite.',
    }),
  },
  {
    name: 'gdpr-subject-notification',
    subject: 'Información importante sobre la protección de tus datos',
    htmlBody: emailLayout({
      eyebrow: 'Protección de datos personales',
      title: 'Notificación de incidente de seguridad',
      accent: '#b42318',
      content: `
        <p style="margin: 0 0 18px;">Te informamos de un incidente de seguridad que pudo afectar tus datos personales.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 10px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
          ${detailRow('Tipo de incidente', '{{type}}')}
          ${detailRow('Fecha de detección', '{{detectedAt}}')}
          ${detailRow('Categorías de datos', '{{dataCategories}}')}
        </table>
        <h2 style="margin: 24px 0 8px; font-size: 17px;">Qué estamos haciendo</h2>
        <p style="margin: 0;">El incidente está siendo investigado y se aplican las medidas de contención correspondientes.</p>
        <h2 style="margin: 20px 0 8px; font-size: 17px;">Qué puedes hacer</h2>
        <p style="margin: 0;">Revisa cualquier actividad inusual relacionada con tu cuenta y contacta al responsable de protección de datos si necesitas información adicional.</p>
        <p style="margin: 16px 0 0;"><a href="mailto:{{dpoEmail}}" style="color: #155eef;">{{dpoEmail}}</a></p>`,
      footer: 'Aviso de protección de datos emitido por Voting Suite.',
    }),
  },
  {
    name: 'gdpr-deadline-alert',
    subject: '[{{urgency}}] Plazo GDPR Art. 33 · Brecha {{breachId}}',
    htmlBody: emailLayout({
      eyebrow: 'Control de plazo regulatorio',
      title: '{{deadlineTitle}}',
      accent: '#b42318',
      content: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 10px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
          ${detailRow('Identificador', '{{breachId}}')}
          ${detailRow('Tipo', '{{type}}')}
          ${detailRow('Severidad', '{{severity}}')}
          ${detailRow('Personas afectadas', '{{affectedUsers}}')}
          ${detailRow('Horas desde la detección', '{{hoursSinceDetection}}')}
          ${detailRow('Estado del plazo', '{{deadlineStatus}}')}
        </table>
        <p style="margin: 22px 0 0;"><strong>Acción requerida:</strong> revisa el expediente y gestiona la notificación a la autoridad desde el panel GDPR.</p>`,
      footer:
        'Alerta interna automática del control de 72 horas del artículo 33.',
    }),
  },
  {
    name: 'gdpr-breach-notification',
    subject: 'Notificación de brecha de seguridad · Voting Suite',
    htmlBody: emailLayout({
      eyebrow: 'Protección de datos personales',
      title: 'Notificación de brecha de seguridad',
      accent: '#b42318',
      content: `
        <p style="margin: 0 0 18px;">Se detectó un incidente que puede afectar datos personales.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 10px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
          ${detailRow('Descripción', '{{description}}')}
          ${detailRow('Severidad', '{{severity}}')}
          ${detailRow('Fecha de detección', '{{detectedAt}}')}
        </table>
        <p style="margin: 20px 0 0;">Para consultas, escribe a <a href="mailto:{{dpoEmail}}" style="color: #155eef;">{{dpoEmail}}</a>.</p>`,
    }),
  },
  {
    name: 'custom',
    subject: '{{title}}',
    htmlBody: emailLayout({
      eyebrow: 'Comunicación de Voting Suite',
      title: '{{title}}',
      content: '{{{content}}}',
    }),
  },
];
