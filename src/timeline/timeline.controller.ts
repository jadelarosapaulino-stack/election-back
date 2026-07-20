import {
  Controller,
  Post,
  Body,
} from '@nestjs/common';

import { TimelineService } from './timeline.service';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';

@Controller('questions')
@Auth(ValidRoles.admin)
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Post('timeline')
  async vote(@Body() body: any) {
    await this.timelineService.logAction({
      entityId: body.voterId,
      electionId: body.electionId,
      action: body.action,
      metadata: { meta: body },
    });

    // lógica para registrar el voto...

    return { success: true };
  }
}
