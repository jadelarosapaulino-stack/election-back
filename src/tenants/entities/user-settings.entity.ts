import { User } from '../../auth/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

@Entity('users-settings')
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 100 })
  name: string; // Nombre único de la organización / cliente

  @Column({ nullable: true, length: 255 })
  description?: string;

  @Column({ nullable: true, length: 255 })
  logoUrl?: string;

  @Column({ nullable: true, length: 255 })
  contactEmail?: string;

  @Column({ nullable: true, length: 20 })
  contactPhone?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
