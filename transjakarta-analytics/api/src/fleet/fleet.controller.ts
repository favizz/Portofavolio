import { Controller, Get, Param } from '@nestjs/common';
import { FleetService } from './fleet.service';

@Controller('fleet')
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  @Get(':routeId')
  forRoute(@Param('routeId') routeId: string) {
    return this.fleet.forRoute(routeId);
  }
}
