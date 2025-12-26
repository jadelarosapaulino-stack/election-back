import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export class Imgs {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  url: string;
}
