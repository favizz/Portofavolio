import { Controller, Get, Param } from '@nestjs/common';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get()
  findAll() {
    return this.routes.findAll();
  }

  @Get(':id/stops')
  findStops(@Param('id') id: string) {
    return this.routes.findStopsForRoute(id);
  }
}
