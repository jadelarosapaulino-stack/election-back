import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'catalog_items' })
@Index(['groupKey', 'code'], { unique: true })
export class CatalogItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  groupKey: string;

  @Column('text')
  code: string;

  @Column('text')
  label: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('int', { default: 0 })
  sortOrder: number;

  @Column('boolean', { default: true })
  active: boolean;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, unknown>;

  @Column('timestamp', { nullable: true })
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @BeforeInsert()
  setCreateAt() {
    this.createdAt = new Date();
  }

  @BeforeUpdate()
  setUpdateAt() {
    this.updatedAt = new Date();
  }
}
