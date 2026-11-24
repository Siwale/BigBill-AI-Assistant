import { z } from "zod";

/**
 * Local, human-handoff creative brief. It is deliberately not sent to Khapy in
 * Loop 1: the verified Khapy API requires a member JWT, organisation
 * membership and an evidence-gated request that this product cannot satisfy yet.
 */
export const creativeBriefSchema = z.object({
  campaignName: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(800),
  productOrService: z.string().trim().min(1).max(300),
  audience: z.string().trim().min(1).max(800),
  keyMessage: z.string().trim().min(1).max(500),
  offer: z.string().trim().max(300).optional(),
  channels: z.array(z.enum(["facebook", "linkedin", "instagram", "whatsapp", "web"])).min(1),
  tone: z.string().trim().min(1).max(120),
  formats: z.array(z.string().trim().min(1).max(80)).min(1),
  brandConstraints: z.array(z.string().trim().max(200)).default([]),
  requiredClaims: z.array(z.string().trim().max(200)).default([]),
  prohibitedClaims: z.array(z.string().trim().max(200)).default([]),
  requestedDeliverables: z.array(z.string().trim().max(200)).min(1),
  approvalStatus: z.literal("draft").default("draft"),
});

export type CreativeBrief = z.infer<typeof creativeBriefSchema>;

export function renderCreativeBrief(brief: CreativeBrief): string {
  return [
    `# Creative brief (draft): ${brief.campaignName}`,
    "",
    `**Objective:** ${brief.objective}`,
    `**Product / service:** ${brief.productOrService}`,
    `**Audience:** ${brief.audience}`,
    `**Key message:** ${brief.keyMessage}`,
    ...(brief.offer ? [`**Offer:** ${brief.offer}`] : []),
    `**Channels:** ${brief.channels.join(", ")}`,
    `**Tone:** ${brief.tone}`,
    `**Formats:** ${brief.formats.join(", ")}`,
    `**Requested deliverables:** ${brief.requestedDeliverables.join(", ")}`,
    ...(brief.brandConstraints.length ? [`**Brand constraints:** ${brief.brandConstraints.join("; ")}`] : []),
    ...(brief.requiredClaims.length ? [`**Required claims:** ${brief.requiredClaims.join("; ")}`] : []),
    ...(brief.prohibitedClaims.length ? [`**Prohibited claims:** ${brief.prohibitedClaims.join("; ")}`] : []),
    "",
    "**Status:** Draft for human review. Not delivered to Khapy.",
  ].join("\n");
}
