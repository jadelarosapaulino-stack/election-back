import { Auth, GetUser } from 'src/auth/decorators';
import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { ElectionsService } from './elections.service';
import { CreateElectionDto } from './dto/create-election.dto';
import { UpdateElectionDto } from './dto/update-election.dto';
import { User } from 'src/auth/entities/user.entity';
import { ValidRoles } from 'src/auth/interfaces';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('elections')
@Auth(ValidRoles.admin)
export class ElectionsController {
  constructor(private readonly electionsService: ElectionsService) {}

  @Post()  
  create(@Body() createElectionDto: CreateElectionDto,
  @GetUser() user: User) {    
    return this.electionsService.create(createElectionDto, user);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto, @GetUser() user: User) {
    return this.electionsService.findAll(paginationDto, user);
  }

  @Get(':term')
  findOne(@Param('term') term: string, @GetUser() user: User) {
    return this.electionsService.findOne(term, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateElectionDto: UpdateElectionDto, @GetUser() user: User) {
    return this.electionsService.update(id, updateElectionDto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.remove(id, user);
  }
}
