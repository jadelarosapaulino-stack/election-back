import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { ElectionConfigService } from '../election-config/election-config.service';

@Injectable()
export class ElectionConfigLockGuard implements CanActivate {
  constructor(private readonly configService: ElectionConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const electionId = request.params.electionId;
    const userId = request.query.userId;

    const config = await this.configService.findOne(electionId, userId);

    const status = this.configService.getElectionStatus(config);

    if (status === 'STARTED' || status === 'ENDED') {
      throw new BadRequestException(
        `Election configuration cannot be modified once it has ${status.toLowerCase()}`,
      );
    }

    return true;
  }
}
