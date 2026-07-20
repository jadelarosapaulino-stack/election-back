import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'api_request_logs' })
export class ApiRequestLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  method: string;

  @Column('text')
  path: string;

  @Column('int')
  statusCode: number;

  @Column('int')
  latencyMs: number;

  @Column('text', { nullable: true })
  ipAddress: string | null;

  @Column('text', { nullable: true })
  userAgent: string | null;

  @Column('timestamp', { default: () => 'now()' })
  createdAt: Date;
}
