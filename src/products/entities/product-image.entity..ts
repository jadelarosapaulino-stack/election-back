import { Column, Entity, ManyToOne } from 'typeorm';
import { Product } from './product.entity';
import { Imgs } from './image.entity';

@Entity({ name: 'product-imgs'})
export class ProductImgs extends Imgs {
  @ManyToOne(() => Product, (item) => item.images, {
    onDelete: 'CASCADE',
  })
  product: Product;
}
