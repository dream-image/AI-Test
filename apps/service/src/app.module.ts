import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphModule } from './graph/graph.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MidsceneModule } from './midscene/midscene.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.dev.env',
      isGlobal: true,
    }),
    MidsceneModule,
    // GraphModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
