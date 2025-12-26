import { User } from './../auth/entities/user.entity';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { VotersService } from './voters.service';
import { CreateVoterDto } from './dto/create-voter.dto';
import { UpdateVoterDto } from './dto/update-voter.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createObjectCsvStringifier } from 'csv-writer';
import { GetUser } from 'src/auth/decorators/get-user.decorator';

@Controller('voter')
export class VotersController {
  constructor(private readonly votersService: VotersService) {}

  @Post()
  create(@Body() createVoterDto: CreateVoterDto) {
    return this.votersService.create(createVoterDto);
  }

  @Get(':electionId')
  findAll(
    @Query() paginationDto: PaginationDto,
    @Param('electionId', ParseUUIDPipe) electionId: string,
  ) {
    return this.votersService.findAll(electionId, paginationDto);
  }

  @Get(':electionId/all')
  async findAllVoters(@Param('electionId') electionId: string) {
    return this.votersService.getVotersOfElection(electionId);
  }

  @Get('voter/:voterid')
  findOne(@Param('voterid', ParseUUIDPipe) voterid: string) {
    return this.votersService.findOne(voterid);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVoterDto: UpdateVoterDto) {
    return this.votersService.update(id, updateVoterDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.votersService.remove(id);
  }

  @Delete(':electionId/remove-all')
  removeAll(@Param('electionId') electionId: string, @GetUser() user: User) {
    return this.votersService.deleteAllByElection(electionId, user);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: any,
    @GetUser() user: User
  ) {
    const resp = await this.votersService.importFromCsv(
      file.buffer,
      data?.electionId,
      data?.metadata,
      user      
    );
    return resp;
  }

  /**
   * List all voters that are duplicated by name + identifier
   */
  @Get('duplicates')
  async findDuplicates(@Query('electionId') electionId?: string) {
    return this.votersService.findDuplicates(electionId);
  }

  /**
   * Delete all duplicate voters keeping only the first one
   */
  @Delete('duplicates/:electionId')
  async removeDuplicates(@Param('electionId') electionId: string) {
    if (!electionId) throw new BadRequestException('electionId is required');

    const deleted = await this.votersService.deleteDuplicatesByElection(electionId);
    return { deleted };
  }

  /**
   * Export duplicate voters (by name + identifier) to CSV, optionally filtered by election
   */
  @Get('duplicates/export')
  async exportDuplicatesCSV(
    @Res() res: Response,
    @Query('electionId') electionId?: string,
  ) {
    if (!electionId) {
      throw new BadRequestException(
        'Query parameter "electionId" is required.',
      );
    }

    const duplicates = await this.votersService.findDuplicates(electionId);

    if (duplicates.length === 0) {
      return res.status(204).send(); // No content
    }

    const csv = createObjectCsvStringifier({
      header: [
        { id: 'id', title: 'ID' },
        { id: 'name', title: 'Name' },
        { id: 'identifier', title: 'Identifier' },
        { id: 'createdAt', title: 'Created At' },
      ],
    });

    const records = duplicates.map((voter) => ({
      id: voter.id,
      name: voter.name,
      identifier: voter.identifier,
      createdAt: voter.createdAt,
    }));

    const csvContent = csv.getHeaderString() + csv.stringifyRecords(records);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="duplicate_voters.csv"',
    );
    return res.send(csvContent);
  }

  @Get('duplicates/preview')
  async previewDuplicates(@Query('electionId') electionId: string, @GetUser() user: User) {
    if (!electionId) {
      throw new BadRequestException('electionId is required');
    }
    return this.votersService.previewDuplicatesByElection(electionId, user);
  }
}
