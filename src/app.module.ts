import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';
import { SeedModule } from './seed/seed.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { ElectionsModule } from './elections/elections.module';
import { QuestionsModule } from './questions/questions.module';
import { OptionsModule } from './options/options.module';
import { UtilsModule } from './utils/utils.module';
import { VotersModule } from './voters/voters.module';
import { CommonModule } from './common/common.module';
import { VoteModule } from './vote/vote.module';
import { TimelineModule } from './timeline/timeline.module';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsModule } from './tenants/user-settings.module';
import { TenantMiddleware } from './tenants/middleware/users-settings.middleware';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      autoLoadEntities: true,
      synchronize: true
    }),
    MongooseModule.forRoot(process.env.MONGO_URI),
    ProductsModule,
    CommonModule,
    SeedModule,
    FilesModule,
    AuthModule,
    QuestionsModule,
    OptionsModule,
    UtilsModule,
    VotersModule,
    VoteModule,
    TimelineModule,
    ElectionsModule,
    TenantsModule
  ]
})
export class AppModule {
  // configure(consumer: MiddlewareConsumer) {
  //   consumer
  //     .apply(TenantMiddleware)
  //     .forRoutes({ path: '*', method: RequestMethod.ALL });
  // }
}