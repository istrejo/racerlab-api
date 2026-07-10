import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthStatusDto } from './dto/health-status.dto';
import { HealthService, HealthStatus } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    description: 'The API and database connection are available.',
    type: HealthStatusDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'The database connection is unavailable.',
    schema: {
      example: {
        message: 'Database is unavailable',
        error: 'Service Unavailable',
        statusCode: 503,
      },
    },
  })
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
