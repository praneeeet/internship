import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
    app.enableCors({
    origin: 'http://localhost:5173', // Allow this origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allow these HTTP methods
    credentials: true, // Allow cookies/auth headers
    allowedHeaders: 'Content-Type,Authorization', // Allow these headers
  });
  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}
bootstrap();
