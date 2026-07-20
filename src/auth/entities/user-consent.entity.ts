import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'user_consents' })
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column('text')
  consentType: string; // 'privacy_policy', 'terms_of_service', 'marketing'

  @Column('text')
  policyVersion: string;

  @Column('timestamptz')
  acceptedAt: Date;

  @Column('text', { nullable: true })
  ipAddress: string;

  @Column('boolean', { default: true })
  revoked: boolean;

  @Column('timestamptz', { nullable: true })
  revokedAt: Date;
}
