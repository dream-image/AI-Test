import { Module } from '@nestjs/common';
import { GraphService } from './graph.service.js';
import { GraphController } from './graph.controller.js';

@Module({
  providers: [GraphService],
  controllers: [GraphController],
  exports: [GraphService],
})
export class GraphModule {}
