import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('smtp_providers')
@Index(['isDefault'], {
  unique: true,
  where: '"isDefault" = true',
})
export class SmtpProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'custom' })
  providerType: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'varchar', length: 255, default: '' })
  host: string;

  @Column({ type: 'integer', default: 587 })
  port: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  user: string;

  @Column({ type: 'text', default: '' })
  pass: string;

  @Column({ type: 'boolean', default: false })
  secure: boolean;

  @Column({ type: 'boolean', default: true })
  requireTls: boolean;

  @Column({ type: 'varchar', length: 150, default: 'Voting Suite' })
  fromName: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  fromEmail: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
