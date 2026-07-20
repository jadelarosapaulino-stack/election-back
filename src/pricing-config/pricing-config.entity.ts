import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'pricing_config' })
export class PricingConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 10, scale: 4, default: 0.10 })
  enterprisePricePerVoter: number;

  @Column('text', { default: 'usd' })
  currency: string;

  @Column('timestamp', { nullable: true })
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  updatedAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}
