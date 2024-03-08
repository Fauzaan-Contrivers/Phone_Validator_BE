import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const server = app.getHttpServer();
  const expressApp = server.getHttpServer();
  expressApp.keepAliveTimeout = 600000;
  await app.listen(8000);
}
bootstrap();
