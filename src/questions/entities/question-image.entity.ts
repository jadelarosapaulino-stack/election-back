import { Entity, ManyToOne } from 'typeorm';
import { Imgs } from 'src/products/entities';
import { Question } from './question.entity';

@Entity({ name: 'question-imgs'})
export class QuestionsImgs extends  Imgs {
  @ManyToOne(() => Question, (item) => item.images, {
    onDelete: 'CASCADE',
  })
  question: Question;
}
