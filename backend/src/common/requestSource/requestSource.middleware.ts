import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  parseRequestSource,
  REQUEST_SOURCE_HEADER,
  runWithRequestSource,
} from './requestSource';

// Makes the X-Field-Client header ("web" | "mobile") available to the rest
// of the request, so audit entries can record which app made a change
// without every service passing it along.
@Injectable()
export class RequestSourceMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction) {
    runWithRequestSource(
      parseRequestSource(request.headers[REQUEST_SOURCE_HEADER]),
      next,
    );
  }
}
