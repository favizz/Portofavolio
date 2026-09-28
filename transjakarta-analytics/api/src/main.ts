import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Read-only public data with no cookies or logins, so any site may call it. A locked-down origin made the demo hang on "Connecting" from any other URL.
  app.enableCors({ origin: '*' });

  const port = process.env.PORT || 3001;
  // Render (and most container platforms) route to the app via its
  // internal network - binding to 0.0.0.0 is required, 'localhost' only
  // would make the app unreachable from outside the container.
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on 0.0.0.0:${port}`);
}
bootstrap();
