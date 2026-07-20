import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'twilio_config' })
export class TwilioConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('boolean', { default: false })
  enabled: boolean;

  @Column('boolean', { default: false })
  useSandbox: boolean;

  @Column('text')
  accountSid: string;

  @Column('text')
  authToken: string;

  @Column('text', { nullable: true })
  messagingServiceSid: string | null;

  @Column('text', { nullable: true })
  verifyServiceSid: string | null;

  @Column('text', { nullable: true })
  fromNumber: string | null;

  @Column('text', { nullable: true })
  statusCallbackUrl: string | null;

  @Column('text', { default: '+1' })
  defaultCountryCode: string;

  @Column('timestamp', { nullable: true })
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  updatedAt: Date;
}
