import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const plans = await prisma.dailyPlan.findMany({
    orderBy: { date: "asc" },
    include: { tasks: true },
  });

  const events = plans.flatMap((plan) =>
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
        startTime: parsed.startTime ?? null,
        endTime: parsed.endTime ?? null,
      };
    })
  );

  return NextResponse.json(events);
}
