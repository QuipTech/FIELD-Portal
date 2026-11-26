import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { RequireFeature } from '../../entitlements/requireFeature.guard';
import { FEATURE_KEYS } from '../../entitlements/featureKeys';
import { RequireActiveMachineGuard } from '../../machineLifecycle/activeMachine/requireActiveMachine.guard';
import { IncomingFile } from '../../storage/types/storedFile';
import { MC_PERMISSIONS } from '../access/machineControlAccess';
import { RequireMachineControlGuard } from '../access/requireMachineControl.guard';
import { PairedDevice } from '../session/deviceSession.service';
import {
  CurrentDevice,
  CurrentDeviceToken,
  DeviceTokenGuard,
} from '../session/deviceToken.guard';
import { ConnectByFieldIdDto } from '../tablets/tabletAccess.dtos';
import { RemoteSessionService } from './remoteSession.service';
import {
  CreateRemoteSessionDto,
  REMOTE_MAX_PART_BYTES,
  RemoteDecisionDto,
  RemoteHeartbeatDto,
  RemoteRecordingCompleteDto,
  RequestRemoteHelpDto,
} from './remoteSession.types';

// Remote support from a FIELD ID and password alone; the machine comes from
// the tablet, and its access and state are checked in the service.
@Controller('mc/remote-access')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard, RequireMachineControlGuard)
@RequirePermissions(MC_PERMISSIONS.remote)
export class RemoteAccessController {
  constructor(private readonly sessions: RemoteSessionService) {}

  @Post('connect')
  connect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectByFieldIdDto,
  ) {
    return this.sessions.connectByFieldId(user, dto);
  }
}

// The Portal side of remote support on one machine. Needs Machine Control
// and the mc.remote permission.
@Controller('machines/:machineId/remote-sessions')
@UseGuards(
  JwtAuthGuard,
  RequirePermissionsGuard,
  RequireMachineControlGuard,
  RequireActiveMachineGuard,
)
@RequirePermissions(MC_PERMISSIONS.remote)
export class RemoteSessionController {
  constructor(private readonly sessions: RemoteSessionService) {}

  // Connect: asks the machine's tablet; the operator Allows or Declines.
  // Starting and joining need remote sessions in the plan; past sessions'
  // recordings stay readable.
  @Post()
  @RequireFeature(FEATURE_KEYS.remoteSession)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: CreateRemoteSessionDto,
  ) {
    return this.sessions.create(actor, machineId, dto);
  }

  @Get('help/current')
  @Header('Cache-Control', 'no-store')
  @RequireFeature(FEATURE_KEYS.remoteSession)
  pendingHelp(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.sessions.pendingHelp(actor, machineId);
  }

  @Post(':sessionId/claim')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @RequireFeature(FEATURE_KEYS.remoteSession)
  claimHelp(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.claimHelp(actor, machineId, sessionId);
  }

  @Get(':sessionId')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.get(actor, machineId, sessionId);
  }

  @Post(':sessionId/connection')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @RequireFeature(FEATURE_KEYS.remoteSession)
  connection(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.viewerConnection(actor, machineId, sessionId);
  }

  @Post(':sessionId/heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RemoteHeartbeatDto,
  ) {
    return this.sessions.viewerHeartbeat(
      actor,
      machineId,
      sessionId,
      dto.interacted ?? false,
    );
  }

  @Post(':sessionId/end')
  @HttpCode(HttpStatus.OK)
  end(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.endFromPortal(actor, machineId, sessionId);
  }

  // Admins (mc.remote_delete): delete the recording and transcript only.
  @Delete(':sessionId/recording')
  @RequirePermissions(MC_PERMISSIONS.remoteDelete)
  deleteRecording(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.deleteRecording(actor, machineId, sessionId);
  }

  // Admins (mc.remote_delete): delete the recording and remove the session
  // from the machine's History.
  @Delete(':sessionId')
  @RequirePermissions(MC_PERMISSIONS.remoteDelete)
  deleteSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.deleteSession(actor, machineId, sessionId);
  }

  // multipart/form-data with one "part" file field.
  @Put(':sessionId/recording/parts/:partNumber')
  @UseInterceptors(
    FileInterceptor('part', {
      limits: { fileSize: REMOTE_MAX_PART_BYTES + 1, files: 1, fields: 0 },
    }),
  )
  uploadPart(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('partNumber', ParseIntPipe) partNumber: number,
    @UploadedFile() file: IncomingFile | undefined,
  ) {
    return this.sessions.uploadRecordingPart(
      actor,
      machineId,
      sessionId,
      partNumber,
      file,
    );
  }

  @Post(':sessionId/recording/complete')
  @HttpCode(HttpStatus.OK)
  completeRecording(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RemoteRecordingCompleteDto,
  ) {
    return this.sessions.completeRecording(
      actor,
      machineId,
      sessionId,
      dto.failed ?? false,
    );
  }

  @Get(':sessionId/recording')
  @Header('Cache-Control', 'no-store')
  recording(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.recordingUrl(actor, machineId, sessionId);
  }

  @Get(':sessionId/transcript')
  @Header('Cache-Control', 'no-store')
  transcript(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.transcript(actor, machineId, sessionId);
  }
}

// The tablet's side, signed in with its device token.
@Controller('mc/device/remote-sessions')
@UseGuards(DeviceTokenGuard)
export class DeviceRemoteSessionController {
  constructor(private readonly sessions: RemoteSessionService) {}

  @Post('help')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  requestHelp(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
    @Body() dto: RequestRemoteHelpDto,
  ) {
    return this.sessions.requestHelp(device, token, dto);
  }

  @Get('current')
  @Header('Cache-Control', 'no-store')
  current(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
  ) {
    return this.sessions.currentForDevice(device, token);
  }

  @Get(':sessionId')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.getForDevice(device, token, sessionId);
  }

  @Post(':sessionId/decision')
  @HttpCode(HttpStatus.OK)
  decide(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RemoteDecisionDto,
  ) {
    return this.sessions.decide(device, token, sessionId, dto);
  }

  @Post(':sessionId/connection')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  connection(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.tabletConnection(device, token, sessionId);
  }

  @Post(':sessionId/heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RemoteHeartbeatDto,
  ) {
    return this.sessions.tabletHeartbeat(
      device,
      token,
      sessionId,
      dto.interacted ?? false,
    );
  }

  @Post(':sessionId/end')
  @HttpCode(HttpStatus.OK)
  end(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.endFromTablet(device, token, sessionId);
  }
}
