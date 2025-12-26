// src/elections/entities/election-config.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { IsEnum } from 'class-validator';
import { Election } from 'src/elections/entities/election.entity';
import { UserSettings } from 'src/tenants/entities/user-settings.entity';
import { User } from 'src/auth/entities/user.entity';

export enum VotingMode {
  FIRST_PAST_THE_POST = 'FPTP',
  RANKED = 'RANKED',
  APPROVAL = 'APPROVAL',
  SINGLE_TRANSFERABLE_VOTE = 'STV',
}

export enum ResultVisibility {
  AFTER_END = 'AFTER_END',
  DURING = 'DURING',
  NEVER = 'NEVER',
}

export enum TieBreaker {
  RANDOM = 'RANDOM',
  RUNOFF = 'RUNOFF',
  BY_LEAST_ERRORS = 'BY_LEAST_ERRORS',
}

@Entity('election_configs')
@Index(['electionId', 'userId'], { unique: true })
export class ElectionConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // relacion con la tabla elections
  @ManyToOne(() => Election, (e) => e.configs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'electionId' })
  election: Election;

  @Column()
  electionId: string;

  @ManyToOne(() => User, (user) => user.elections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  // Fechas
 @Column({ type: 'timestamp', nullable: true })
startAt?: Date;

@Column({ type: 'timestamp', nullable: true })
endAt?: Date;

  // Zona horaria opcional (ej. "America/Santo_Domingo")
  @Column({ type: 'text', nullable: true })
  timezone?: string;

  // Modo de votación
  @Column({
    type: 'enum',
    enum: VotingMode,
    default: VotingMode.FIRST_PAST_THE_POST,
  })
  @IsEnum(VotingMode)
  votingMode: VotingMode;

  // Limites y reglas
  @Column({ type: 'int', default: 1 })
  maxVotesPerVoter: number; // ej. 1 para voto único

  @Column({ type: 'boolean', default: false })
  allowMultipleSelections: boolean; // para listas donde se elige más de 1 opción

  @Column({ type: 'boolean', default: true })
  requireAuthentication: boolean;

  @Column({ type: 'boolean', default: false })
  anonymousVoting: boolean; // si true, almacenar votos sin link al votante

  // Visual / branding
  @Column({ type: 'varchar', length: 255, nullable: true })
  logoUrl?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  theme?: string; // nombre del tema css/tailwind

  // Resultados
  @Column({
    type: 'enum',
    enum: ResultVisibility,
    default: ResultVisibility.AFTER_END,
  })
  resultVisibility: ResultVisibility;

  @Column({ type: 'enum', enum: TieBreaker, default: TieBreaker.RANDOM })
  tieBreaker: TieBreaker;

  @Column({ type: 'boolean', default: false })
  allowWriteIns: boolean;

  @Column({ type: 'json', nullable: true })
  extra?: Record<string, any>; // campo libre para futuras opciones (e.g. widgets, webhooks)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
