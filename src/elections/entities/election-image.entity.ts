import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Election } from 'src/elections/entities/election.entity';
import { Imgs } from 'src/products/entities';

@Entity({ name: 'election-imgs'})
export class ElectionImgs extends  Imgs {
  // @ManyToOne(() => Setting, (item) => item.images, {
  //   onDelete: 'CASCADE',
  // })
  // setting: Setting;
}
