import { Controller, Post, Body } from '@nestjs/common';
import { GraphService } from './graph.service';

@Controller('graph')
export class GraphController {
    constructor(private readonly graphService: GraphService) { }

    @Post('run')
    async run(@Body('input') input: string) {
        return this.graphService.runGraph(input);
    }
}
