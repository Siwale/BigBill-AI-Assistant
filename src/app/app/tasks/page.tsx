import { requireOnboardedPageSession } from "@/modules/auth/session";
import { listTasks } from "@/modules/tasks/service";
import { TasksBoard } from "@/components/tasks/tasks-board";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await requireOnboardedPageSession();
  const tasks = await listTasks({ tenantId: session.user.tenantId, userId: session.user.id });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Tasks</h1>
          <p>
            Commitments in this workspace. Your assistant can create and update them when you ask, and every
            change is audited.
          </p>
        </div>
      </header>
      <TasksBoard
        initialTasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          dueAt: task.dueAt ? task.dueAt.toISOString() : null,
          priority: task.priority,
          status: task.status,
          source: task.source,
          createdAt: task.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
