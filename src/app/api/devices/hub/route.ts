import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { capabilityMatrix, listDevices, registerDevice, updateDeviceStatus } from "@/modules/devices/service";

const registerSchema = z.object({
  adapter: z.string().min(2).max(50),
  transport: z.string().min(2).max(50),
  deviceClass: z.string().min(2).max(50),
  providerDeviceId: z.string().min(1).max(500),
  displayName: z.string().min(1).max(200),
  friendlyName: z.string().max(200).optional(),
  capabilities: z.array(z.string().max(30)).max(20).default([]),
  status: z.string().max(20).optional(),
});

const statusSchema = z.object({ deviceId: z.string().uuid(), status: z.string().min(2).max(20), diagnostic: z.string().max(500).optional() });

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const [devices, matrix] = await Promise.all([listDevices(session.user.tenantId, session.user.id), Promise.resolve(capabilityMatrix())]);
    return NextResponse.json({ devices, capabilityMatrix: matrix });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.deviceId === "string") {
      const input = statusSchema.parse(body);
      const updated = await updateDeviceStatus({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        deviceId: input.deviceId,
        status: input.status,
        diagnostic: input.diagnostic,
        correlationId,
      });
      return NextResponse.json({ device: updated });
    }
    const input = registerSchema.parse(body);
    const device = await registerDevice({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      adapter: input.adapter,
      transport: input.transport,
      deviceClass: input.deviceClass,
      providerDeviceId: input.providerDeviceId,
      displayName: input.displayName,
      friendlyName: input.friendlyName,
      capabilities: input.capabilities,
      status: input.status,
      correlationId,
    });
    return NextResponse.json({ device }, { status: 201 });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
