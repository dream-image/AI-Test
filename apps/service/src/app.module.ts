import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphModule } from './graph/graph.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.dev.env',
      isGlobal: true,
    }),
    GraphModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
