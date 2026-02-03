import { Module } from '@nestjs/common';
import { MidsceneService } from './index.service';
import { GraphController } from './index.controller';

@Module({
    providers: [MidsceneService],
    controllers: [GraphController],
    exports: [MidsceneService],
})
export class MidsceneModule { }
