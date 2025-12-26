// vote.entity.ts
import { Options } from 'src/options/entities/option.entity';
import { Voter } from 'src/voters/entities/voter.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity({ name: 'votes' })
export class Vote {
  @PrimaryGeneratedColumn()
  id: string

  @ManyToOne(() => Voter, voter => voter.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'voterId' })
  voter: Voter;

  @ManyToOne(() => Options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'optionId' })
  option: Options;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  votedAt: Date;
}
