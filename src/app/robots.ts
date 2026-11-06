import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3005";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/portal/",
        "/dashboard",
        "/invoices",
        "/clients",
        "/estimates",
        "/settings",
        "/recurring",
        "/ai-create",
        "/onboarding",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
