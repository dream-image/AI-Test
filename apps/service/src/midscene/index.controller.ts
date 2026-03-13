import { Controller, Post, Body } from '@nestjs/common';
import { MidsceneService } from './index.service.js';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: MidsceneService) {}

  @Post('run')
  async run(@Body('input') input: string) {}
}
