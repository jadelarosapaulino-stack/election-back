import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DpiaStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'needs_update';

@Entity({ name: 'gdpr_dpia_records' })
export class DpiaRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  processName: string; // 'Voting process', 'Fraud detection'

  @Column('text')
  description: string;

  @Column('text')
  legalBasis: string;

  @Column('text', { array: true })
  dataCategories: string[];

  @Column('text')
  necessityAndProportionality: string;

  @Column('text')
  risksToDataSubjects: string;

  @Column('text')
  measuresToAddressRisks: string;

  @Column('text', { default: 'draft' })
  status: DpiaStatus;

  @Column('text', { nullable: true })
  reviewedBy?: string; // DPO name or email

  @Column('timestamptz', { nullable: true })
  reviewedAt?: Date;

  @Column('text', { nullable: true })
  approvalNotes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
