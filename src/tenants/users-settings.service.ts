import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { RequestContext } from 'nestjs-request-context';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly tenantRepo: Repository<UserSettings>,
  ) {}

  async create(data: Partial<UserSettings>) {
    const tenant = this.tenantRepo.create(data);
    return await this.tenantRepo.save(tenant);
  }

  async findAll() {
    return await this.tenantRepo.find();
  }

  async findOne(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async update(id: string, data: Partial<UserSettings>) {
    const tenant = await this.findOne(id);
    Object.assign(tenant, data);
    return await this.tenantRepo.save(tenant);
  }

  async remove(id: string) {
    const tenant = await this.findOne(id);
    await this.tenantRepo.remove(tenant);
    return { message: `Tenant ${id} removed successfully` };
  }

   getTenantId(): string {
    const request = RequestContext.currentContext.req;
    const userId = request.tenantId;
    return userId; // El id es nuestro tenantId
  }
}