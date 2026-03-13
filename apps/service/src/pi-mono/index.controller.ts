import { Controller, Post, Body } from '@nestjs/common';
import { PiMonoService } from './index.service.js';

@Controller('pi-mono')
export class PiMonoController {
  constructor(private readonly piMonoService: PiMonoService) {}

  @Post('run')
  async run(@Body('input') input: string) {}
}
