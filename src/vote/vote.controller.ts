import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VoteService } from './vote.service';
import { CastVoteDto } from './dto/create-vote.dto';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';

@Controller('vote')
@Auth(ValidRoles.admin)
export class VoteController {
  constructor(private readonly voteService: VoteService) {}

  @Post()
  create(@Body() createVoteDto: CastVoteDto) {
    return this.voteService.castVote(createVoteDto);
  }
}
