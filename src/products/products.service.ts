import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { validate as isUUID } from 'uuid';
import { Product } from './entities';
import { ProductImgs } from './entities/product-image.entity.';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImgs)
    private readonly productImageRepository: Repository<ProductImgs>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetails } = createProductDto;

      const product = this.productRepository.create({
        ...productDetails,
        images: images.map(image =>
          this.productImageRepository.create({ url: image }))
      });
      await this.productRepository.save(product);

      return {...product, images};
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    try {
      const { limit = 10, offset = 0 } = paginationDto;
      const producs = await this.productRepository.find({
        take: limit,
        skip: offset,
        relations: {
          images: true
        }
      });
      return producs.map(({images, ...rest}) => ({
        ...rest,
        images: images.map( img => img.url)
      }));
      
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async findOne(term: string) {
    term = term.toLowerCase();
    let product: Product;

    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term });
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder('prod');

      product = await queryBuilder
        .where('LOWER(title)=:title or slug=:slug', {
          title: term,
          slug: term,
        })
        .leftJoinAndSelect('prod.images','prodImages')
        .getOne();
    }

    if (!product) throw new NotFoundException(`Product with ${term} not fount`);

    return product;
  }

  async findOnePlain( term: string) {
    const { images = [], ...rest } = await this.findOne(term);

    return {
      ...rest,
      images: images.map( img => img.url)
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto) {

    const { images, ...toUpdate } = updateProductDto
    const product = await this.productRepository.preload({
      id: id,
      ...toUpdate,
      images: [],
    });

    if (!product)
      throw new NotFoundException(`Prodcut with id: ${id} not fount`);

    //Create queryRunner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      if ( images ) {
        await queryRunner.manager.delete( ProductImgs, { product: { id }});
        product.images = images.map( image => this.productImageRepository.create({url: image}))
      }

      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      // await this.productRepository.save(product);
      return product;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDBExceptions(error);
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id);

    await this.productRepository.remove(product);
  }

  async deleteAllProduct() {
    const query = this.productRepository.createQueryBuilder('product');

    try {
      return await query
                  .delete()
                  .where({})
                  .execute()
    } catch (error) {
      this.handleDBExceptions(error);      
    }
  }

  private handleDBExceptions(error: any) {
    if (error.code == '20505') throw new BadRequestException(error.detail);

    this.logger.error(error);
    throw new InternalServerErrorException(error.detail);
  }
}
