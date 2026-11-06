import { z } from "zod";

const CurrencySchema = z.enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "NOK", "SEK", "DKK"]);
const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format").refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a real calendar date");

function validateCurrencyPrecision(
  input: { currency?: string; items: Array<{ quantity: number; unitPrice: number }> },
  context: z.RefinementCtx,
) {
  if (input.currency !== "JPY") return;
  input.items.forEach((item, index) => {
    if (!Number.isInteger(item.quantity * item.unitPrice)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "unitPrice"],
        message: "JPY line totals must be whole yen",
      });
    }
  });
}

export const InvoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(500),
  quantity: z.coerce.number().positive("Quantity must be positive").max(1_000_000),
  unitPrice: z.coerce.number().nonnegative("Unit price cannot be negative").max(99_999_999.99),
});

export const CreateInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Invoice number is required").max(80),
  clientId: z.string().uuid("Select a valid client"),
  clientName: z.string().trim().min(1).max(160),
  clientEmail: z.string().trim().email().max(254),
  clientAddress: z.string().max(500).optional(),
  businessName: z.string().trim().min(1).max(160),
  businessEmail: z.string().trim().email().max(254).or(z.literal("")).optional(),
  businessAddress: z.string().max(500).optional(),
  issueDate: DateOnlySchema,
  dueDate: DateOnlySchema,
  currency: CurrencySchema.default("USD"),
  status: z.enum(["Draft", "Sent"]).optional().default("Draft"),
  items: z.array(InvoiceItemSchema).min(1).max(200),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  discountRate: z.coerce.number().min(0).max(100).optional().default(0),
  notes: z.string().max(5000).optional(),
  purchaseOrderNumber: z.string().trim().max(100).optional(),
}).superRefine(validateCurrencyPrecision);

export type CreateInvoiceInput = z.input<typeof CreateInvoiceSchema>;

export const UpdateInvoiceStatusSchema = z.object({
  id: z.string().uuid("Invalid invoice ID"),
  status: z.enum(["Draft", "Sent", "Overdue"]),
});

export const UpdateInvoicePOSchema = z.object({
  token: z.string().uuid("Invalid portal token"),
  purchaseOrderNumber: z.string().trim().min(1, "PO Number is required").max(100),
});

export const AddInvoiceCommentSchema = z.object({
  token: z.string().uuid("Invalid portal token"),
  senderName: z.string().trim().min(1, "Sender name is required").max(100),
  text: z.string().trim().min(1, "Comment text is required").max(2000),
});

export const CreateClientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(160),
  email: z.string().trim().email("Invalid email address").max(254),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(500).optional(),
  currency: CurrencySchema.default("USD"),
  notes: z.string().trim().max(5000).optional(),
});

export type CreateClientInput = z.input<typeof CreateClientSchema>;

export const CreateEstimateSchema = z.object({
  estimateNumber: z.string().trim().min(1, "Estimate number is required").max(80),
  clientId: z.string().uuid("Select a valid client"),
  clientName: z.string().trim().min(1).max(160),
  clientEmail: z.string().trim().email().max(254),
  clientAddress: z.string().max(500).optional(),
  businessName: z.string().trim().min(1).max(160),
  businessEmail: z.string().trim().email().max(254).or(z.literal("")).optional(),
  businessAddress: z.string().max(500).optional(),
  issueDate: DateOnlySchema,
  validUntil: DateOnlySchema,
  currency: CurrencySchema.default("USD"),
  status: z.enum(["Draft", "Sent"]).optional().default("Draft"),
  items: z.array(InvoiceItemSchema).min(1).max(200),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  discountRate: z.coerce.number().min(0).max(100).optional().default(0),
  notes: z.string().max(5000).optional(),
}).superRefine(validateCurrencyPrecision);

export type CreateEstimateInput = z.input<typeof CreateEstimateSchema>;
