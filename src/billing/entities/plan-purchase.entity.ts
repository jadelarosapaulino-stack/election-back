import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Election } from 'src/elections/entities/election.entity';

export enum PlanPurchaseStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELED = 'canceled',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity({ name: 'plan_purchases' })
export class PlanPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  user?: User;

  @ManyToOne(() => Election, { nullable: true })
  election?: Election;

  @Column('text')
  planId: string;

  @Column('text', { nullable: true })
  priceId?: string;

  @Index({ unique: true })
  @Column('text', { nullable: true })
  stripeSessionId?: string;

  @Column('text', { nullable: true })
  stripeEventId?: string;

  @Column('text', { nullable: true })
  stripeCustomerId?: string;

  @Column('text', { nullable: true })
  stripeSubscriptionId?: string;

  @Column('text', { nullable: true })
  customerEmail?: string;

  @Column('int', { nullable: true })
  amount?: number;

  @Column('text', { nullable: true })
  currency?: string;

  @Column('int', { nullable: true })
  capacity?: number;

  @Column('enum', { enum: PlanPurchaseStatus, default: PlanPurchaseStatus.PENDING })
  status: PlanPurchaseStatus;

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
