import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { OrderDto, UpdateOrderDto } from 'src/options/dto/update-option-order.dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { User } from 'src/auth/entities/user.entity';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';

@Controller('questions')
@Auth(ValidRoles.admin)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  create(@Body() createQuestionDto: CreateQuestionDto, @GetUser() user: User) {
    return this.questionsService.create(createQuestionDto, user);
  }

  @Get(':term')
  findAll(
    @Param('term', ParseUUIDPipe) term: string,
    @Query() paginationDto: PaginationDto,
    @GetUser() user: User
  ) {
    return this.questionsService.findAll(term, paginationDto, user);
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.questionsService.findOne(id);
  // }

  @Patch('update/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    updateQuestionDto: UpdateQuestionDto,
    @GetUser() user: User
  ) {
    return this.questionsService.update(id, updateQuestionDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string , @GetUser() user: User) {
    return this.questionsService.remove(id, user);
  }

  @Delete(':electionId/delete-all')
  removeAll(@Param('electionId') electionId: string, @GetUser() user: User) {
    return this.questionsService.deleteAllQuestions(electionId, user)
  }

  // Reorder questions
  @Patch('reorder')
  async reorderQuestions(@Body() dto: OrderDto[], @GetUser() user: User) {
    return await this.questionsService.reorderQuestions(dto, user);
  }

  // Reorder options
  @Patch(':questionId/options/reorder')
  async reorderOptions(
    @Param('questionId') questionId: string,
    @Body() dto: OrderDto[],
    @GetUser() user: User
  ) {
    return await this.questionsService.reorderOptions(questionId, dto, user);
  }
}
