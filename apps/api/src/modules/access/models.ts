import { Schema, model, type Types } from 'mongoose';
import type { StaffRole } from '../../models.js';

export interface SiteDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  timezone: string;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
const siteSchema = new Schema<SiteDoc>({
  orgId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  timezone: { type: String, required: true, default: 'Asia/Dubai' },
  archivedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'sites' });
siteSchema.index({ orgId: 1, archivedAt: 1 });
export const Site = model<SiteDoc>('Site', siteSchema);

export interface AccessTokenDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  email: string;
  purpose: 'verify' | 'reset' | 'invite';
  tokenHash: string;
  role?: StaffRole;
  siteIds: Types.ObjectId[];
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}
const accessTokenSchema = new Schema<AccessTokenDoc>({
  orgId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, default: null },
  email: { type: String, required: true, trim: true, lowercase: true },
  purpose: { type: String, enum: ['verify', 'reset', 'invite'], required: true },
  tokenHash: { type: String, required: true },
  role: { type: String, enum: ['supervisor', 'administrator', 'auditor'] },
  siteIds: { type: [Schema.Types.ObjectId], default: [] },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'access_tokens' });
accessTokenSchema.index({ tokenHash: 1 }, { unique: true });
accessTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AccessToken = model<AccessTokenDoc>('AccessToken', accessTokenSchema);

const invoiceSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, required: true },
  number: { type: String, required: true },
  amountMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: 'USD' },
  status: { type: String, enum: ['issued', 'paid', 'void'], default: 'issued' },
  paidAt: { type: Date, default: null },
  note: { type: String, maxlength: 500 },
}, { timestamps: true, collection: 'invoices' });
invoiceSchema.index({ orgId: 1, createdAt: -1 });
invoiceSchema.index({ orgId: 1, number: 1 }, { unique: true });
export const Invoice = model('Invoice', invoiceSchema);

const planRequestSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, required: true },
  requestedBy: { type: Schema.Types.ObjectId, required: true },
  message: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['pending', 'reviewed'], default: 'pending' },
}, { timestamps: true, collection: 'plan_requests' });
planRequestSchema.index({ orgId: 1, createdAt: -1 });
export const PlanRequest = model('PlanRequest', planRequestSchema);

const auditSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, required: true },
  siteId: { type: Schema.Types.ObjectId, default: null },
  actorId: { type: String, required: true },
  action: { type: String, required: true },
  subjectId: { type: String },
  details: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_events' });
auditSchema.index({ orgId: 1, createdAt: -1 });
export const AuditEvent = model('AuditEvent', auditSchema);
