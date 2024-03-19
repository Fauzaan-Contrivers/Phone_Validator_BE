import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance()
  app.enableCors({
    origin: 'https://scrub.callhub.cc'
  });
  app.use(300000, (req, res, next) => {
    res.setTimeout(() => {
      res.status(408).send('Request Timeout')
    });
    next()
  })

  await app.listen(8000);
}
bootstrap();
