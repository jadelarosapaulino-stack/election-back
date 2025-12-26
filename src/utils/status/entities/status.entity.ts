import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({name: 'status'})
export class Status {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  title: string;

  @Column('text')
  color: string;
}
