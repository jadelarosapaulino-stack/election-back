import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'landing_content' })
export class LandingContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  pageSlug: string;

  @Column('text')
  pageTitle: string;

  @Column('jsonb', { default: {} })
  content: Record<string, unknown>;

  @Column('text', { nullable: true })
  metaTitle: string;

  @Column('text', { nullable: true })
  metaDescription: string;

  @Column('uuid', { nullable: true })
  parentId: string | null;

  @Column('int', { default: 0 })
  sortOrder: number;

  @Column('text', { default: 'published' })
  status: 'draft' | 'published' | 'archived';

  @Column('text', { nullable: true })
  template: string | null;

  @Column('text', { nullable: true })
  icon: string | null;

  @Column('boolean', { default: true })
  isNavVisible: boolean;

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
