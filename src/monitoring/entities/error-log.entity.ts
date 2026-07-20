import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'error_logs' })
export class ErrorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  severity: string;

  @Column('text')
  service: string;

  @Column('text')
  message: string;

  @Column('text', { nullable: true })
  stackTrace: string | null;

  @Column('jsonb', { nullable: true })
  context: Record<string, unknown> | null;

  @Column('timestamp', { default: () => 'now()' })
  createdAt: Date;
}
