import { requireOnboardedPageSession } from "@/modules/auth/session";
import { MusicPanel } from "@/components/music/music-panel";

export const dynamic = "force-dynamic";

export default async function MusicPage() {
  await requireOnboardedPageSession();
  return (
    <div className="page">
      <header className="page-header"><div><h1>Music</h1><p>Local library + Home Assistant first. Spotify voice blocked, Apple Music gated.</p></div></header>
      <MusicPanel />
    </div>
  );
}
