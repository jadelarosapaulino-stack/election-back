import { Election } from 'src/elections/entities/election.entity';
import { Vote } from 'src/vote/entities/vote.entity';
import { BeforeInsert, BeforeUpdate, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

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

  @Column({ type: 'text' })
  password?: string;

  @Column('timestamp', { nullable: true })
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  updatedAt: Date; 
  
  @Column('boolean', { default: false })
  vote: boolean;

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
