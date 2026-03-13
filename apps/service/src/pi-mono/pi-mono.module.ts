import { Module } from '@nestjs/common';
import { PiMonoService } from './index.service.js';
import { PiMonoController } from './index.controller.js';

@Module({
  providers: [PiMonoService],
  controllers: [PiMonoController],
  exports: [PiMonoService],
})
export class PiMonoModule {}
