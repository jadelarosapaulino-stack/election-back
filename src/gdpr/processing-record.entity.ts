import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'gdpr_processing_records' })
export class ProcessingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  controllerName: string; // 'Voting Suite' or tenant name

  @Column('text')
  processingPurpose: string; // 'Gestión de votantes', 'Detección de fraude'

  @Column('text', { array: true })
  dataCategories: string[]; // 'nombre', 'email', 'identificador', 'ip'

  @Column('text', { array: true })
  dataSubjects: string[]; // 'votantes', 'administradores'

  @Column('text')
  legalBasis: string; // 'consent', 'contract', 'legal_obligation', 'legitimate_interest'

  @Column('text', { array: true, default: [] })
  recipients: string[];

  @Column('text')
  retentionPeriod: string; // '365 días', 'hasta eliminación de cuenta'

  @Column('boolean', { default: false })
  transferOutsideEU: boolean;

  @Column('text', { nullable: true })
  transferSafeguards?: string; // 'SCC', 'adequacy_decision'

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
