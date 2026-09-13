import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: the frontend is a separate deployment (its own Render/Vercel
  // URL), so this needs to accept cross-origin requests. Restrict to a
  // configured origin in production if you want to lock this down further.
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
  });

  const port = process.env.PORT || 3001;
  // Render (and most container platforms) route to the app via its
  // internal network - binding to 0.0.0.0 is required, 'localhost' only
  // would make the app unreachable from outside the container.
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on 0.0.0.0:${port}`);
}
bootstrap();
