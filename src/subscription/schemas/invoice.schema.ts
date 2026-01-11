/// Invoice Schema Placeholder
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
}

@Schema({ timestamps: true })
export class Invoice {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  stripeInvoiceId: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: Number, required: true })
  amountDue: number;

  @Prop({ type: Number, default: 0 })
  amountPaid: number;

  @Prop({ type: String, enum: Object.values(InvoiceStatus), default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: String })
  invoicePdf?: string;

  @Prop({ type: String })
  hostedInvoiceUrl?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export type InvoiceDocument = Invoice & Document;
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

// Indexes
InvoiceSchema.index({ userId: 1, createdAt: -1 });
InvoiceSchema.index({ stripeInvoiceId: 1 }, { unique: true });
InvoiceSchema.index({ status: 1 });
