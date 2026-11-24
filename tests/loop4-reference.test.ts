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
});
