import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'gdpr_dpa_records' })
export class DpaRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  subprocessorName: string;

  @Column('text')
  subprocessorEmail: string;

  @Column('text')
  servicesProvided: string; // 'Email delivery', 'Hosting'

  @Column('text')
  country: string; // 'Germany', 'Argentina'

  @Column('boolean', { default: false })
  outsideEU: boolean;

  @Column('text', { nullable: true })
  transferSafeguards?: string; // 'SCC', 'Binding Corporate Rules'

  @Column('timestamptz')
  validFrom: Date;

  @Column('timestamptz', { nullable: true })
  validUntil?: Date;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('text', { nullable: true })
  dpaDocumentPath?: string; // Path to signed DPA document

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
