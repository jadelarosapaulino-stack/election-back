import { Election } from 'src/elections/entities/election.entity';
import { Vote } from 'src/vote/entities/vote.entity';
import { BeforeInsert, BeforeUpdate, Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'voters' })
export class Voter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text'})
  name: string;

  @Column({ type: 'text', nullable: true })
  email?: string;

 @ManyToOne(() => Election, election => election.voters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'electionId' })
  election: Election;

  @Column({ type: 'text' })
  identifier?: string;

  @Column({ type: 'text', select: false })
  password?: string;

  @Column('timestamp', { nullable: true })
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  updatedAt: Date; 

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
  
  @Column('boolean', { default: false })
  vote: boolean;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => Vote, (vote) => vote.voter, {eager: true})
  votes: Vote[];

  @BeforeInsert()
  setCreateAt() {
    this.createdAt = new Date();
  }

  @BeforeUpdate()
  setUpdateAt() {
    this.updatedAt = new Date();
  }

  get mongoVoterId(): string {
    return this.id;
  }
}
