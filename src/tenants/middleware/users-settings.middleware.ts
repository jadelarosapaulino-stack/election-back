import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;

    // Lista de rutas que NO requieren tenant
    const excludedPaths = ['/api/auth', '/public'];

    // Si la ruta empieza con alguna excluida → saltar
    if (excludedPaths.some(route => path.startsWith(route))) {
      return next();
    }

    // Obtener tenantId desde header o query string
    const tenantId =
      (req.headers['x-tenant-id'] as string) || (req.query['tenantId'] as string);

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // Guardar tenantId en request
    (req as any).tenantId = tenantId;

    next();
  }
}
