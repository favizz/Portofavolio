import { Controller, Get, Query } from '@nestjs/common';
import { NetworkService } from './network.service';

@Controller('network')
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @Get('graph')
  graph(@Query('minSharedStops') minSharedStops?: string, @Query('topN') topN?: string) {
    return this.network.graph(
      minSharedStops ? parseInt(minSharedStops, 10) : undefined,
      topN ? parseInt(topN, 10) : undefined
    );
  }
}
