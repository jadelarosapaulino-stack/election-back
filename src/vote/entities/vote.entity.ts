// vote.entity.ts
import { Options } from 'src/options/entities/option.entity';
import { Voter } from 'src/voters/entities/voter.entity';
import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity({ name: 'votes' })
export class Vote {
  @PrimaryGeneratedColumn()
  id: string

  @ManyToOne(() => Voter, voter => voter.votes, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'voterId' })
  voter: Voter | null;

  @ManyToOne(() => Options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'optionId' })
  option: Options;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  votedAt: Date;

  @Column({ type: 'boolean', default: false })
  isDemo: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  encryptionAlg?: string | null;

  @Column({ type: 'text', nullable: true })
  encryptedPayload?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  receiptCode?: string | null;

  @Column({ type: 'text', nullable: true })
  receiptHash?: string | null;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
