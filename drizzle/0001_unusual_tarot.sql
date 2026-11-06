ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "businesses" DROP CONSTRAINT "businesses_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "clients_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "estimates" DROP CONSTRAINT "estimates_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "estimates" DROP CONSTRAINT "estimates_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "purchase_order_number" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "estimates_business_estimate_number_uq" ON "estimates" USING btree ("business_id","estimate_number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_business_invoice_number_uq" ON "invoices" USING btree ("business_id","invoice_number");--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_user_id_unique" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_stripe_account_id_unique" UNIQUE("stripe_account_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_transaction_id_unique" UNIQUE("transaction_id");