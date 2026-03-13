import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Type,
  getModel,
  stream,
  complete,
  Context,
  Tool,
  StringEnum,
} from '@mariozechner/pi-ai';

@Injectable()
export class PiMonoService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // await this.initMidscene();
  }
}
