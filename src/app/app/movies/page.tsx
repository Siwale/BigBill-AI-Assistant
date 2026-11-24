import { requireOnboardedPageSession } from "@/modules/auth/session";
import { MoviesPanel } from "@/components/movies/movies-panel";

export const dynamic = "force-dynamic";

export default async function MoviesPage() {
  await requireOnboardedPageSession();
  return (
    <div className="page">
      <header className="page-header"><div><h1>Movies</h1><p>Search, taste preferences (ZM default), watchlist. Licensed availability only when provider active.</p></div></header>
      <MoviesPanel />
    </div>
  );
}
