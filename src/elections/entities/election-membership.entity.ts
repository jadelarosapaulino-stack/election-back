import { User } from '../../auth/entities/user.entity';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Election } from './election.entity';

export enum ElectionMembershipRole {
  COMMISSION = 'commission',
  OBSERVER = 'observer',
}

export enum ElectionMembershipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
}

@Entity({ name: 'election_memberships' })
@Index(['electionId', 'email'], { unique: true })
export class ElectionMembership {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column('uuid') electionId: string;
  @ManyToOne(() => Election, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'electionId' }) election: Election;

  @Column('uuid', { nullable: true }) userId: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' }) user: User | null;

  @Column('text') email: string;
  @Column('text', { nullable: true }) name: string | null;
  @Column({ type: 'enum', enum: ElectionMembershipRole }) role: ElectionMembershipRole;
  @Column({ type: 'enum', enum: ElectionMembershipStatus, default: ElectionMembershipStatus.PENDING }) status: ElectionMembershipStatus;
  @Column('uuid', { nullable: true }) invitedById: string | null;
  @Column('timestamptz', { nullable: true }) acceptedAt: Date | null;
  @Column('timestamptz', { nullable: true }) revokedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
