import { BadRequestException } from '@nestjs/common';
import { ElectionsService } from './elections.service';
import { StatusType } from '../utils/status-type.enum';

describe('ElectionsService MVP rules', () => {
  const createService = () =>
    new ElectionsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

  const createServiceWithMembership = (membership: any) =>
    new ElectionsService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      { findOne: jest.fn().mockResolvedValue(membership) } as any,
      {} as any, {} as any, {} as any, {} as any, {} as any,
    );

  it('keeps an observer read-only even when the account has an admin role elsewhere', async () => {
    const service = createServiceWithMembership({ role: 'observer', status: 'accepted' }) as any;
    await expect(service.ensureElectionManagementAccess(
      { id: 'election-b', user: { id: 'owner-b' } },
      { id: 'admin-a', email: 'admin@org-a.test', roles: ['admin'] },
    )).rejects.toThrow();
  });

  it('allows an accepted commission membership without a global commission role', async () => {
    const service = createServiceWithMembership({ role: 'commission', status: 'accepted' }) as any;
    await expect(service.ensureElectionManagementAccess(
      { id: 'election-b', user: { id: 'owner-b' } },
      { id: 'user-a', email: 'user@org-a.test', roles: ['user'] },
    )).resolves.toBeUndefined();
  });

  it('does not mark wizard steps complete only because they were persisted', () => {
    const service = createService() as any;
    const state = service.buildWizardState(
      { id: 'election-1', status: StatusType.ACTIVE },
      {
        ready: false,
        requirements: [
          { key: 'basic_info', done: true, evidence: {} },
          { key: 'schedule', done: false, evidence: {} },
          { key: 'authentication', done: false, evidence: {} },
          { key: 'voters', done: false, evidence: {} },
          { key: 'ballot_questions', done: false, evidence: {} },
          { key: 'ballot_options', done: false, evidence: {} },
          { key: 'results', done: false, evidence: {} },
          { key: 'demo_clean', done: false, evidence: {} },
          { key: 'demo_review', done: false, evidence: {} },
        ],
        approvals: [],
        summary: { requiredApprovalsComplete: false },
      },
      { currentStep: 'schedule', completedSteps: ['schedule'] },
    );

    const schedule = state.steps.find((step) => step.key === 'schedule');
    expect(schedule.status).toBe('blocked');
    expect(state.completedSteps).toEqual(['basic_info']);
  });

  it('normalizes supervision members by election and removes duplicates', () => {
    const service = createService() as any;
    const members = service.normalizedSupervisionMembers([
      { email: 'COMISION@ORG.COM', role: 'comision', name: 'Comision' },
      { email: 'comision@org.com', role: 'commission', name: 'Duplicado' },
      { email: 'audit@org.com', role: 'auditor' },
    ]);

    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ email: 'comision@org.com', role: 'commission' });
    expect(members[1]).toMatchObject({ email: 'audit@org.com', role: 'observer' });
  });

  it('blocks production when demo votes still need explicit cleanup', async () => {
    const service = createService() as any;
    jest.spyOn(service, 'buildReadiness').mockResolvedValue({
      ready: false,
      requirements: [{ done: false, label: 'Ensayo separado de produccion' }],
      approvals: [],
    });

    await expect(service.ensureReadyForProduction({ id: 'election-1' }, {})).rejects.toThrow(BadRequestException);
  });
});
