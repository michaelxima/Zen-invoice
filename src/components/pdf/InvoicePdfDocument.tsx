"use client";

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4f46e5",
    textTransform: "uppercase",
  },
  invoiceMeta: {
    textAlign: "right",
  },
  metaText: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 2,
  },
  metaBold: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
  },
  billingSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  block: {
    width: "48%",
  },
  blockTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  businessName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  clientName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  table: {
    width: "100%",
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  colDesc: { width: "50%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "17.5%", textAlign: "right" },
  colAmount: { width: "17.5%", textAlign: "right" },
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 30,
  },
  totalsTable: {
    width: "40%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: "#4f46e5",
    marginTop: 4,
  },
  grandTotalText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4f46e5",
  },
  notesSection: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 15,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.4,
  },
});

export interface PdfInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PdfInvoiceProps {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  businessName: string;
  businessEmail: string;
  businessAddress: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  items: PdfInvoiceItem[];
  taxRate: number;
  discountRate: number;
  notes?: string;
}

export function InvoicePdfDocument({
  invoiceNumber,
  issueDate,
  dueDate,
  currency,
  businessName,
  businessEmail,
  businessAddress,
  clientName,
  clientEmail,
  clientAddress,
  items,
  taxRate,
  discountRate,
  notes,
}: PdfInvoiceProps) {
  const getSymbol = (curr: string) => {
    switch (curr) {
      case "EUR": return "€";
      case "GBP": return "£";
      case "JPY": return "¥";
      default: return "$";
    }
  };

  const symbol = getSymbol(currency);

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const discountAmount = subtotal * (discountRate / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxAmount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>
              #{invoiceNumber || "INV-0001"}
            </Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.metaText}>Issue Date: <Text style={styles.metaBold}>{issueDate}</Text></Text>
            <Text style={styles.metaText}>Due Date: <Text style={styles.metaBold}>{dueDate}</Text></Text>
            <Text style={styles.metaText}>Currency: <Text style={styles.metaBold}>{currency}</Text></Text>
          </View>
        </View>

        {/* Business & Client Billing Info */}
        <View style={styles.billingSection}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Billed From</Text>
            <Text style={styles.businessName}>{businessName || "Your Business Name"}</Text>
            <Text style={styles.metaText}>{businessEmail}</Text>
            <Text style={styles.metaText}>{businessAddress}</Text>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Billed To</Text>
            <Text style={styles.clientName}>{clientName || "Client Name"}</Text>
            <Text style={styles.metaText}>{clientEmail}</Text>
            <Text style={styles.metaText}>{clientAddress}</Text>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Item Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>

          {items.map((item, idx) => {
            const lineAmount = item.quantity * item.unitPrice;
            return (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.colDesc}>{item.description || "Line Item"}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colPrice}>{symbol}{item.unitPrice.toFixed(2)}</Text>
                <Text style={styles.colAmount}>{symbol}{lineAmount.toFixed(2)}</Text>
              </View>
            );
          })}
        </View>

        {/* Totals Summary */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={{ color: "#64748b" }}>Subtotal:</Text>
              <Text style={{ fontWeight: "bold" }}>{symbol}{subtotal.toFixed(2)}</Text>
            </View>

            {discountRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={{ color: "#64748b" }}>Discount ({discountRate}%):</Text>
                <Text style={{ color: "#ef4444" }}>-{symbol}{discountAmount.toFixed(2)}</Text>
              </View>
            )}

            {taxRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={{ color: "#64748b" }}>Tax ({taxRate}%):</Text>
                <Text style={{ fontWeight: "bold" }}>+{symbol}{taxAmount.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalText}>Total Due:</Text>
              <Text style={styles.grandTotalText}>{symbol}{total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Notes & Payment Terms */}
        {notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes & Payment Terms</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
