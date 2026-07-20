import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'service_status' })
export class ServiceStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  serviceName: string;

  @Column('text')
  status: string;

  @Column('timestamp', { default: () => 'now()' })
  lastCheckedAt: Date;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  uptimePct: number | null;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown> | null;

  @Column('timestamp', { default: () => 'now()' })
  updatedAt: Date;
}
