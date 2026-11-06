/** Data-transfer types shared by server actions and client components. */

export interface LineItemDto {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface ClientDto {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  currency: string;
  notes?: string;
  invoiceCount?: number;
  totalBilled?: number;
  createdAt: string;
}

export interface InvoiceCommentDto {
  id: string;
  sender: "client" | "issuer";
  senderName: string;
  text: string;
  createdAt: string;
}

export interface InvoiceReminderDto {
  id: string;
  type: string;
  tone: "friendly" | "formal" | "urgent";
  sentAt: string;
  recipientEmail: string;
}

export interface InvoiceAuditLogDto {
  id: string;
  invoiceId: string;
  action: "created" | "sent" | "dispatched" | "viewed" | "downloaded" | "po_updated" | "comment_added" | "payment_attempted" | "status_changed" | "cancelled" | "paid" | "reminder_sent";
  timestamp: string;
  metadata?: string;
  ipAddress?: string;
}

export interface InvoiceDto {
  id: string;
  accessToken: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  businessName: string;
  businessEmail: string;
  businessAddress?: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";
  deliveryStatus: "Created" | "Sent" | "Opened" | "Downloaded" | "Paid" | "Cancelled";
  items: LineItemDto[];
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  paymentLink?: string;
  purchaseOrderNumber?: string;
  dispatchedAt?: string;
  viewedAt?: string;
  downloadedAt?: string;
  paidAt?: string;
  paymentMethod?: "stripe";
  comments: InvoiceCommentDto[];
  remindersSent: InvoiceReminderDto[];
  createdAt: string;
}

export interface EstimateDto {
  id: string;
  accessToken: string;
  estimateNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  businessName: string;
  businessEmail: string;
  businessAddress?: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  status: "Draft" | "Sent" | "Accepted" | "Declined" | "Invoiced";
  items: LineItemDto[];
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  convertedInvoiceId?: string;
  createdAt: string;
}
