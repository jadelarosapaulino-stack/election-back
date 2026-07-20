import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { I18nExceptionFilter } from './common/i18n/i18n-exception.filter';
import { MonitoringService } from './monitoring/monitoring.service';
import { ApiRequestLogsInterceptor } from './monitoring/interceptors/api-request-logs.interceptor';
import { MonitoringExceptionFilter } from './monitoring/filters/monitoring-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const monitoringService = app.get(MonitoringService);
  app.useGlobalInterceptors(new ApiRequestLogsInterceptor(monitoringService));
  app.useGlobalFilters(new MonitoringExceptionFilter(monitoringService, new I18nExceptionFilter()));

  // Security: Helmet middleware (H-15) — must be before CORS
  app.use(helmet());

  // Security: Restrictive CORS (H-13)
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:4200',
      'http://localhost:4201',
      'http://localhost:4202',
      'http://localhost:4205',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Security: Swagger disabled in production (H-16)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Elections API')
      .setDescription('Elections API Description')
      .setVersion('1.0')
      .addTag('elections')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(`App running on port ${port}`)
}
bootstrap();
