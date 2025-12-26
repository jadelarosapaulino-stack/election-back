import { User } from 'src/auth/entities/user.entity';
import { Election } from 'src/elections/entities/election.entity';
import { Question } from 'src/questions/entities/question.entity';
import { OptionType } from 'src/utils/option-type.enum';
import { Vote } from 'src/vote/entities/vote.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'options' })
@Unique(['question', 'order'])
export class Options {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  title: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('int', { default: 0 })
  order?: number;

  @Column('text', { nullable: true })
  images?: string;

  @Column('text', { nullable: true })
  files?: string;

  @Column('enum', { enum: OptionType, default: OptionType.STANDARD })
  type?: OptionType;

  @ManyToOne(() => Election, (election) => election.options, { onDelete: 'CASCADE' })
  election: Election;

@ManyToOne(() => Question, question => question.options, { onDelete: 'CASCADE' })
  question: Question;

@ManyToOne(() => User, (user) => user.elections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Vote, (vote) => vote.option)
  votes: Vote[];

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
