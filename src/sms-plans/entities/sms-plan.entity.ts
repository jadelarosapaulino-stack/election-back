import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'sms_plans' })
export class SmsPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column('text')
  code: string;

  @Column('text')
  name: string;

  @Column('int')
  smsLimit: number;

  @Column('int', { default: 0 })
  unitAmount: number;

  @Column('text', { default: 'usd' })
  currency: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('boolean', { default: true })
  active: boolean;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, unknown>;

  @Column('timestamp', { nullable: true })
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  updatedAt: Date;

  @BeforeInsert()
  setCreateAt() {
    this.createdAt = new Date();
  }

  @BeforeUpdate()
  setUpdateAt() {
    this.updatedAt = new Date();
  }
}
