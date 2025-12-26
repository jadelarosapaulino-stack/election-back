import { Election } from 'src/elections/entities/election.entity';
import { Imgs } from 'src/products/entities/image.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuestionsImgs } from './question-image.entity';
import { QuestionType } from 'src/utils/question-type.enum';
import { Options } from 'src/options/entities/option.entity';
import { User } from 'src/auth/entities/user.entity';

@Entity({ name: 'questions' })
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  title: string;

  @Column('text')
  description: string;

  @Column('int', { default: 0 })
  order: number;

  @OneToMany(() => QuestionsImgs, (image) => image.question, {
    cascade: true,
    eager: true,
  })
  images?: QuestionsImgs[];

  @OneToMany(() => Options, (option) => option.question, {
    cascade: true,
    eager: true,
  })
  options?: Options[];

  @Column('uuid')
  election: string;

  @ManyToOne(() => User, (user) => user.elections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column('int', { default: 1 })
  minSelect?: number;

  @Column('int', { default: 1 })
  maxSelect?: number;

  @Column('enum', { enum: QuestionType, default: QuestionType.SINGLE })
  type?: QuestionType;

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
