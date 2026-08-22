import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const categoryMap = new Map([
  ["Study", "Study"],
  ["Coding", "Coding"],
  ["Workout", "Workout"],
  ["Home Workout", "Workout"],
  ["Business", "Business"],
  ["Reading", "Reading"],
  ["Faith", "Faith"],
  ["Nutrition", "Workout"],
  ["Personal", "Study"],
  ["Other", "Study"],
]);

function getDomainName(category: string) {
  return categoryMap.get(category) ?? "Study";
}

function normaliseDate(dateValue: string | Date) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET() {
  const plans = await prisma.dailyPlan.findMany({
    orderBy: { date: "asc" },
    include: { tasks: true },
  });

  const payload = plans.flatMap((plan) =>
    plan.tasks.map((task) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(task.description || "{}") as Record<string, unknown>;
      } catch {
        parsed = { title: task.description || "Plan item", description: "" };
      }

      return {
        id: task.id,
        title: String(parsed.title ?? task.description ?? "Plan item"),
        description: String(parsed.description ?? ""),
        category: String(parsed.category ?? "Personal"),
        date: plan.date.toISOString(),
        priority: String(parsed.priority ?? "Medium"),
        startTime: parsed.startTime ?? null,
        endTime: parsed.endTime ?? null,
        reminder: parsed.reminder ?? null,
        repeat: parsed.repeat ?? null,
      };
    })
  );

  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const title = String(body.title || body.description || "Plan item").trim();
  const category = String(body.category || "Personal");
  const date = normaliseDate(body.date || new Date());
  const description = String(body.description || "").trim();

  const dailyPlan = await prisma.dailyPlan.upsert({
    where: { date },
    create: { date },
    update: {},
  });

  const domainName = getDomainName(category);
  const domain = await prisma.domain.findFirst({ where: { name: domainName } }) ?? await prisma.domain.findFirst({ where: { name: "Study" } });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 500 });
  }

  const payload = JSON.stringify({
    title,
    description,
    category,
    priority: body.priority || "Medium",
    startTime: body.startTime || null,
    endTime: body.endTime || null,
    reminder: body.reminder || null,
    repeat: body.repeat || null,
  });

  if (body.id) {
    const task = await prisma.planTask.update({
      where: { id: body.id },
      data: {
        description: payload,
        domainId: domain.id,
        minutesTarget: Number(body.duration || body.minutesTarget || 30),
      },
    });

    return NextResponse.json({
      id: task.id,
      title,
      description,
      category,
      date: date.toISOString(),
      priority: body.priority || "Medium",
      startTime: body.startTime || null,
      endTime: body.endTime || null,
      reminder: body.reminder || null,
      repeat: body.repeat || null,
    });
  }

  const task = await prisma.planTask.create({
    data: {
      dailyPlanId: dailyPlan.id,
      domainId: domain.id,
      description: payload,
      minutesTarget: Number(body.duration || body.minutesTarget || 30),
      completed: false,
    },
  });

  return NextResponse.json({
    id: task.id,
    title,
    description,
    category,
    date: date.toISOString(),
    priority: body.priority || "Medium",
    startTime: body.startTime || null,
    endTime: body.endTime || null,
    reminder: body.reminder || null,
    repeat: body.repeat || null,
  });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });

  const task = await prisma.planTask.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ ok: true });

  await prisma.planTask.delete({ where: { id } });

  const remainingTasks = await prisma.planTask.count({ where: { dailyPlanId: task.dailyPlanId } });
  if (remainingTasks === 0) {
    await prisma.dailyPlan.delete({ where: { id: task.dailyPlanId } });
  }

  return NextResponse.json({ ok: true });
}
