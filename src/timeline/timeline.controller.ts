import {
  Controller,
  Post,
  Body,
} from '@nestjs/common';

import { TimelineService } from './timeline.service';

@Controller('questions')
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
