import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

function src(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

// Loop 4 reference-accuracy regression guards: fail loudly if a removed
// placeholder or forbidden control creeps back into the command centre.
describe("Loop 4 reference accuracy", () => {
  it("avatar stage has no sphere placeholder or unconditional fallback note", () => {
    const code = src("src/components/command/aida-avatar-stage.tsx");
    expect(code).not.toContain("SphereGeometry(0.85");
    expect(code).not.toContain("Fallback: static poster if WebGL unavailable");
    expect(code).not.toContain("synthetic licensed");
    expect(code).toContain("visemeToMouthState");
  });

  it("conversation has no New-conversation / Start-live-conversation UX", () => {
    const code = src("src/components/chat/chat-workspace.tsx");
    expect(code).not.toContain("Start live conversation");
    expect(code).not.toContain('title: "New conversation"');
    expect(code).not.toContain("ThemeSwitcher");
  });

  it("engineering view renders only real counts and honest progress", () => {
    const code = src("src/components/engineering/engineering-workspace.tsx");
    expect(code).not.toContain("17 findings");
    expect(code).not.toContain("42%");
    expect(code).toContain("no audit yet");
  });

  it("exact sampled palette tokens are defined", () => {
    const css = src("src/app/globals.css");
    for (const token of ["#03070B", "#030B13", "#031423", "#0B4376", "#1598EC", "#31BAF2", "#48C9F4", "#5AD5FB", "#BE8D59", "#DBAE7D", "#1FB580", "#AFD6EA", "#8492A2"]) {
      expect(css.toUpperCase()).toContain(token);
    }
  });

  it("command centre shell has no cream surfaces and no duplicated nav", () => {
    const shell = src("src/components/command/command-shell.tsx");
    expect(shell).toContain('Home');
    expect(shell).toContain('Qylon');
    expect(shell).not.toContain("/app/history");
    const css = src("src/app/globals.css");
    expect(css).toContain(".aida-cc .chat-main");
  });

  it("presence preview is demo-gated and never touches production state", () => {
    const page = src("src/app/app/aida-preview/page.tsx");
    expect(page).toContain("production");
    expect(page).toContain("disabled in production");
    const preview = src("src/components/dev/presence-preview.tsx");
    expect(preview).toContain("DEMO — NOT LIVE");
    expect(preview).not.toMatch(/fetch\(["']\/api\/(chat|conversations|engineering)/);
  });

  it("dead top-nav routes resolve to honest stubs, not 404s", () => {
    for (const route of ["forge", "qylon", "projects", "media"]) {
      const page = src(`src/app/app/${route}/page.tsx`);
      expect(page).toContain("Not connected");
    }
  });

  it("model errors carry status/code for server-side diagnosis", () => {
    const model = src("src/modules/assistant/model.ts");
    expect(model).toContain("status?: number");
    expect(model).toContain("code?: string");
  });

  it("archive tools exist for retrieval with source references", () => {
    const archive = src("src/modules/conversations/archive.ts");
    expect(archive).toContain("searchArchivedConversations");
    expect(archive).toContain("getArchivedConversation");
    const registry = src("src/modules/tools/registry.ts");
    expect(registry).toContain("search_archived_conversations");
  });
});
