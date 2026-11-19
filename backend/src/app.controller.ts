import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('build')
  getBuild() {
    return { buildSha: process.env.BUILD_SHA ?? 'unknown' };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
