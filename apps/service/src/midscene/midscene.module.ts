import { Module } from '@nestjs/common';
import { MidsceneService } from './index.service.js';
import { GraphController } from './index.controller.js';

@Module({
    providers: [MidsceneService],
    controllers: [GraphController],
    exports: [MidsceneService],
})
export class MidsceneModule { }
