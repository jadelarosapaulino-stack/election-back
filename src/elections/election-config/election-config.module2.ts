// import { Module, forwardRef } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { ElectionConfig } from './entities/election-config.entity';
// import { ElectionConfigService } from './election-config.service';
// import { ElectionConfigController } from './election-config.controller';
// import { ElectionsModule } from '../elections.module';

// @Module({
//   imports: [
//     TypeOrmModule.forFeature([ElectionConfig]),
//     forwardRef(() => ElectionsModule),
//   ],
//   controllers: [ElectionConfigController],
//   providers: [ElectionConfigService],
//   exports: [ElectionConfigService],
// })
// export class ElectionConfigModule {}
