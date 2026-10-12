import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { MyDataExportService } from './myDataExport.service';
import { AccountDeletionRequestService } from './accountDeletionRequest.service';

// Profile & settings → My data, for the signed-in user themselves.
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MyDataController {
  constructor(
    private readonly myDataExportService: MyDataExportService,
    private readonly accountDeletionRequestService: AccountDeletionRequestService,
  ) {}

  // Queues an export (202); a background job builds it. 409 while one is
  // already being prepared.
  @Post('data-export')
  @HttpCode(HttpStatus.ACCEPTED)
  requestExport(@CurrentUser() actor: AuthenticatedUser) {
    return this.myDataExportService.requestExport(actor);
  }

  // The newest export and, once ready, its download link (null if none).
  @Get('data-export')
  getLatestExport(@CurrentUser() actor: AuthenticatedUser) {
    return this.myDataExportService.getLatestExport(actor);
  }

  // Records the request and audits it for an admin; deletes nothing.
  @Post('deletion-request')
  @HttpCode(HttpStatus.ACCEPTED)
  requestDeletion(@CurrentUser() actor: AuthenticatedUser) {
    return this.accountDeletionRequestService.requestDeletion(actor);
  }

  @Get('deletion-request')
  getDeletionRequest(@CurrentUser() actor: AuthenticatedUser) {
    return this.accountDeletionRequestService.getPendingRequest(actor);
  }
}
