import { Controller, Post, Body } from '@nestjs/common';
import { MidsceneService } from './index.service';

@Controller('graph')
export class GraphController {
    constructor(private readonly graphService: MidsceneService) { }

    @Post('run')
    async run(@Body('input') input: string) {
        
    }
}
