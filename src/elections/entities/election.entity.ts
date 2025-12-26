import { Question } from 'src/questions/entities/question.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { StatusType } from 'src/utils/status-type.enum';
import { Voter } from 'src/voters/entities/voter.entity';
import { Options } from 'src/options/entities/option.entity';

@Entity({ name: 'elections' })
export class Election {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  title: string;

  @Column('text')
  description: string;

  @Column('timestamp', { nullable: true })
  startDate: Date;

  @Column('timestamp', { nullable: true })
  endDate: Date;

  @OneToMany(() => Question, (question) => question.election, { cascade: true })
  questions: Question[];

  @OneToMany(() => Options, (option) => option.election)
  options: Options[];

  @OneToMany(() => Voter, (voter) => voter.election, {
    cascade: true
  })
  voters: Voter[];

  @Column('enum', { enum: StatusType, default: StatusType.ACTIVWE })
  status?: StatusType;

  @Column('timestamp', { nullable: true })
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.elections)
  user: User;

  @Column('uuid', { nullable: true })
  configs?: string;

  @BeforeInsert()
  setCreateAt() {
    this.createdAt = new Date();
  }

  @BeforeUpdate()
  setUpdateAt() {
    this.updatedAt = new Date();
  }
}
