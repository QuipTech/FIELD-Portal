import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { RequireFeature } from '../../entitlements/requireFeature.guard';
import { FEATURE_KEYS } from '../../entitlements/featureKeys';
import { toCsvText } from '../../common/utils/toCsvText';
import { FleetImportService } from './fleetImport.service';
import { FLEET_IMPORT_TEMPLATE } from './fleetImportRules';
import { ImportFleetDto } from './dto/importFleetDto';

// Machines → Import CSV. Same permission and plan feature as registering
// one machine.
@Controller('machines/import')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions('machine.create')
export class FleetImportController {
  constructor(private readonly fleetImport: FleetImportService) {}

  // The sample file, with the optional group column.
  @Get('template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="fleet-import-template.csv"',
  )
  template(): string {
    return toCsvText(FLEET_IMPORT_TEMPLATE);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequireFeature(FEATURE_KEYS.fleetRegister)
  importFleet(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ImportFleetDto,
  ) {
    return this.fleetImport.importFleet(actor, dto);
  }
}
