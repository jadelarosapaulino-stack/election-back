import * as Handlebars from 'handlebars';
import { EMAIL_TEMPLATE_SEEDS } from './email-config.seed';

const RUNTIME_TEMPLATE_NAMES = [
  'verification-code',
  'password-reset',
  'voter-access-code',
  'voter-invitation',
  'voter-custom-invitation',
  'voter-reminder',
  'gdpr-dpo-notification',
  'gdpr-authority-notification',
  'gdpr-subject-notification',
  'gdpr-deadline-alert',
  'gdpr-breach-notification',
  'custom',
] as const;

describe('email template catalog', () => {
  it('contains one unique template for every runtime email case', () => {
    const names = EMAIL_TEMPLATE_SEEDS.map((template) => template.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(RUNTIME_TEMPLATE_NAMES));
  });

  it('compiles every subject and body with Handlebars', () => {
    for (const template of EMAIL_TEMPLATE_SEEDS) {
      expect(() => Handlebars.compile(template.subject)({})).not.toThrow();
      expect(() => Handlebars.compile(template.htmlBody)({})).not.toThrow();
    }
  });
});
