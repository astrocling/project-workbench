import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { applyUserPersonLinkInTransaction } from "@/lib/userPersonLink";
import { z } from "zod";

const personSelect = { id: true, name: true, email: true } as const;

async function profilePayloadForUser(userId: string) {
  const [user, peopleOptions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        slackUserId: true,
        person: { select: personSelect },
      },
    }),
    prisma.person.findMany({
      where: { OR: [{ userId: null }, { userId: userId }] },
      select: personSelect,
      orderBy: { name: "asc" },
    }),
  ]);

  if (!user) return null;

  return {
    slackUserId: user.slackUserId,
    person: user.person,
    peopleOptions,
  };
}

const patchSchema = z.object({
  slackUserId: z.string().optional().nullable(),
  personId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const payload = await profilePayloadForUser(userId);
  if (!payload) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join("; ");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const wantsSlack = Object.prototype.hasOwnProperty.call(body as object, "slackUserId");
  const wantsPerson = Object.prototype.hasOwnProperty.call(body as object, "personId");

  if (!wantsSlack && !wantsPerson) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (wantsPerson) {
    const raw = parsed.data.personId;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed !== "") {
      const target = await prisma.person.findUnique({
        where: { id: trimmed },
        select: { id: true, userId: true },
      });
      if (!target) {
        return NextResponse.json({ error: "Person not found." }, { status: 400 });
      }
      if (target.userId != null && target.userId !== userId) {
        return NextResponse.json(
          { error: "That Float person is already linked to another account." },
          { status: 400 }
        );
      }
    }
  }

  let slackUserIdNext: string | null | undefined;
  if (wantsSlack) {
    if (parsed.data.slackUserId == null) {
      slackUserIdNext = null;
    } else {
      slackUserIdNext = String(parsed.data.slackUserId).trim() || null;
    }
  }

  await prisma.$transaction(async (tx) => {
    if (wantsPerson) {
      await applyUserPersonLinkInTransaction(tx, userId, parsed.data.personId);
    }
    if (wantsSlack && slackUserIdNext !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { slackUserId: slackUserIdNext },
      });
    }
  });

  const payload = await profilePayloadForUser(userId);
  if (!payload) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
