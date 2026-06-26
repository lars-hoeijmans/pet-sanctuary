import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true
  });

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
