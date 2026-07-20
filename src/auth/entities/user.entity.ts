import { Election } from 'src/elections/entities/election.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', {
    unique: true,
  })
  email: string;

  @Column('text', {
    select: false,
  })
  password: string;

  @Column('text')
  fullName: string;

  @Column('text', { nullable: true })
  organization?: string;

  @Column('bool', {
    default: false,
  })
  isActive: boolean;

  @Column('text', {
    array: true,
    default: ['user'],
  })
  roles: string[];

  @Column({ nullable: true })
  refreshToken?: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'text', nullable: true, select: false })
  verificationCode?: string;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  verificationExpiresAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt?: Date;

  @Column({ type: 'text', nullable: true, select: false })
  passwordResetCode?: string;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  passwordResetExpiresAt?: Date;

  @OneToMany(() => Election, (election) => election.user, { eager: true })
  elections: Election;

  @BeforeInsert()
  @BeforeUpdate()
  checkFieldsBeforeInsert() {
    this.email = this.email.toLocaleLowerCase().trim();
  }

  // @BeforeUpdate()
  // checkFieldsBeforeUpdate() {
  //     this.checkFieldsBeforeInsert();
  // }
}
