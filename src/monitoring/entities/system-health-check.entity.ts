import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'system_health_checks' })
export class SystemHealthCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  service: string;

  @Column('text')
  status: string;

  @Column('int', { nullable: true })
  latencyMs: number | null;

  @Column('text', { nullable: true })
  message: string | null;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown> | null;

  @Column('timestamp', { default: () => 'now()' })
  checkedAt: Date;
}
