import { Controller, Get } from '@nestjs/common';
import { CoverageService } from './coverage.service';

@Controller('coverage')
export class CoverageController {
  constructor(private readonly coverage: CoverageService) {}

  @Get('summary')
  summary() {
    return this.coverage.summary();
  }

  @Get('cells')
  cells() {
    return this.coverage.cells();
  }
}
