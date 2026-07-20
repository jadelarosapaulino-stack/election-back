import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElectionConfigService } from '../election-config/election-config.service';
import { User } from 'src/auth/entities/user.entity';
import { Election } from '../entities/election.entity';
import { StatusType } from 'src/utils/status-type.enum';
import { ElectionRunMode } from '../election-config/entities/election-config.entity';

@Injectable()
export class ElectionConfigLockGuard implements CanActivate {
  constructor(
    private readonly configService: ElectionConfigService,
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const electionId = request.params.electionId || request.params.id;
    const user = request.user as User | undefined;

    if (!user) {
      throw new BadRequestException('User not found in request context');
    }

    const config = await this.configService.findOne(electionId, user);
    const status = this.configService.getElectionStatus(config);
    const election = await this.electionRepository.findOne({
      where: { id: electionId, user: { id: user.id } },
    });

    if (!election) {
      throw new NotFoundException('Election not found');
    }

    const isCompleted = election.status === StatusType.COMPLETED;
    const hasStarted = election.status === StatusType.RUNNING;
    const isEndedProductionRun =
      config.runMode === ElectionRunMode.PRODUCTION &&
      election.status === StatusType.RUNNING &&
      status === 'ENDED';
    const isLockedStatus =
      election.status === StatusType.INACTIVE ||
      election.status === StatusType.SUSPENDED;

    if (isCompleted || hasStarted || isEndedProductionRun || isLockedStatus) {
      const body = request.body || {};
      if (Object.keys(body).length > 0) {
        throw new BadRequestException(
          isLockedStatus
            ? 'Election configuration cannot be modified when election is inactive or suspended'
            : hasStarted
            ? 'Election configuration cannot be modified after voting has started'
            : 'Election configuration cannot be modified after completion',
        );
      }
    }

    return true;
  }
}
