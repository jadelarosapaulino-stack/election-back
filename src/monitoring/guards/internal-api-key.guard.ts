import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string | undefined;
    const expected = process.env.MONITORING_API_KEY;

    // If not configured, allow in dev mode
    if (!expected) {
      return true;
    }

    return apiKey === expected;
  }
}
