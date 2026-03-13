import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphModule } from './graph/graph.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MidsceneModule } from './midscene/midscene.module.js';
import { PiMonoModule } from './pi-mono/pi-mono.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.dev.env',
      isGlobal: true
    }),
    // MidsceneModule,
    // GraphModule,
    PiMonoModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
