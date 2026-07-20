import { Column, DeleteDateColumn, PrimaryGeneratedColumn } from 'typeorm';

export class Imgs {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  url: string;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
