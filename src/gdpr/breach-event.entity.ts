import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BreachStatus =
  | 'detected'
  | 'investigating'
  | 'notified_authority'
  | 'notified_subjects'
  | 'resolved'
  | 'closed';

@Entity({ name: 'gdpr_breach_events' })
export class BreachEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  type: string; // 'data_leak', 'unauthorized_access', 'encryption_failure', 'system_breach'

  @Column('text')
  description: string;

  @Column('int', { default: 0 })
  affectedUsers: number;

  @Column('text')
  severity: BreachSeverity;

  @Column('text', { default: 'detected' })
  status: BreachStatus;

  @Column('text', { nullable: true })
  detectedBy?: string; // 'system', 'user_report', 'external'

  @Column('text', { array: true, default: [] })
  dataCategories: string[]; // 'email', 'name', 'ip', 'voting_data'

  @Column('text', { array: true, nullable: true })
  affectedUserEmails?: string[]; // Art. 34: emails of affected data subjects

  @Column('boolean', { default: false })
  requiresAuthorityNotification: boolean; // Art. 33: risk to rights and freedoms

  @Column('boolean', { default: false })
  requiresSubjectNotification: boolean; // Art. 34: high risk to rights and freedoms

  @Column('timestamptz', { nullable: true })
  authorityNotifiedAt?: Date;

  @Column('timestamptz', { nullable: true })
  subjectsNotifiedAt?: Date;

  @Column('text', { nullable: true })
  authorityReference?: string; // Reference number from supervisory authority

  @Column('text', { nullable: true })
  resolutionNotes?: string;

  @CreateDateColumn()
  detectedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('timestamptz', { nullable: true })
  resolvedAt?: Date;
}
