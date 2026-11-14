import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import type { Request } from 'express';
import { hashPassword, verifyPassword } from '../auth/passwords.js';

const stores = vi.hoisted(() => ({ user: vi.fn(), passwordExists: vi.fn(), org: vi.fn(), sites: vi.fn(), kvGet: vi.fn(), worker: vi.fn() }));
vi.mock('../models.js', () => ({
  User: { findOne: stores.user, exists: stores.passwordExists },
  Organization: { findById: stores.org }, Worker: { findOne: stores.worker },
}));
vi.mock('../modules/access/models.js', () => ({ Site: { find: stores.sites } }));
vi.mock('../stores/kv.js', () => ({ getKv: () => ({ get: stores.kvGet }) }));
import { entitlementOf, requireEntitlement, requireSite, requireStaff, requireWorkerPortal } from '../modules/access/control.js';
import type { OrganizationDoc } from '../models.js';

const orgId = new Types.ObjectId();
const siteId = new Types.ObjectId();
const userId = new Types.ObjectId();
const orgFixture = (patch: Partial<OrganizationDoc> = {}) => ({ _id: orgId, accessStatus: 'active', subscription: 'pilot', expiresAt: new Date(Date.now() + 86400_000), ...patch } as OrganizationDoc);
const request = () => ({ auth: { userId: String(userId), orgId: String(orgId) } } as Request);

describe('password authentication', () => {
  it('uses a distinct random salt and verifies only the actual password', async () => {
    const first = await hashPassword('long correct horse password');
    const second = await hashPassword('long correct horse password');
    expect(first).not.toBe(second);
    expect(first).not.toContain('long correct horse');
    expect(await verifyPassword('long correct horse password', first)).toBe(true);
    expect(await verifyPassword('incorrect password', first)).toBe(false);
  });
  it('rejects absent, malformed, and truncated password records', async () => {
    for (const hash of [undefined, '', 'scrypt-v1:ab:cd', 'other:' + 'ab'.repeat(16) + ':' + 'cd'.repeat(64)]) {
      expect(await verifyPassword('any password', hash)).toBe(false);
    }
  });
});

describe('workspace entitlement and authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.user.mockResolvedValue({ _id: userId, orgId, role: 'supervisor', siteIds: [siteId], emailVerifiedAt: new Date() });
    stores.passwordExists.mockResolvedValue({ _id: userId });
    stores.org.mockResolvedValue(orgFixture());
    stores.sites.mockReturnValue({ select: () => Promise.resolve([{ _id: siteId }]) });
  });
  it('caps pilots at one site and 25 workers even when stored limits are higher', () => {
    const entitlement = entitlementOf(orgFixture({ siteLimit: 99, workerLimit: 999 }));
    expect(entitlement).toMatchObject({ active: true, workerLimit: 25, siteLimit: 1 });
  });
  it('denies pending, suspended, expired, and deleting organizations', async () => {
    for (const patch of [{ accessStatus: 'pending' as const }, { accessStatus: 'suspended' as const }, { expiresAt: new Date(Date.now() - 1) }, { deletingAt: new Date() }]) {
      stores.org.mockResolvedValue(orgFixture(patch));
      await expect(requireEntitlement(String(orgId))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });
  it('uses configured limits for an active paid subscription', async () => {
    stores.org.mockResolvedValue(orgFixture({ subscription: 'paid', siteLimit: 4, workerLimit: 500, expiresAt: null }));
    expect(await requireEntitlement(String(orgId))).toMatchObject({ active: true, workerLimit: 500, siteLimit: 4 });
  });
  it('denies a supervisor owner privileges and access to another site', async () => {
    await expect(requireStaff(request(), ['owner'])).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(requireSite(request(), String(new Types.ObjectId()))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const staff = await requireSite(request(), String(siteId), ['supervisor']);
    expect(staff.role).toBe('supervisor');
    expect(stores.sites).toHaveBeenCalledWith({ orgId, archivedAt: null, _id: { $in: [siteId] } });
  });
  it('rejects disabled staff and password accounts without email verification', async () => {
    stores.user.mockResolvedValue({ _id: userId, orgId, role: 'owner', siteIds: [], disabledAt: new Date() });
    await expect(requireStaff(request())).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    stores.user.mockResolvedValue({ _id: userId, orgId, role: 'owner', siteIds: [], emailVerifiedAt: null });
    await expect(requireStaff(request())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('requires a worker session rather than accepting a staff identity', async () => {
    await expect(requireWorkerPortal(request())).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(stores.worker).not.toHaveBeenCalled();
  });
});
