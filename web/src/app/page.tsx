import { getSnapshot } from "@/lib/snapshot";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

// Default view: the control-panel dashboard. The long-scroll launch-page
// layout is preserved at /classic and reachable from the top bar.
export const revalidate = 300;

export default async function Home() {
  const snapshot = await getSnapshot();
  return <DashboardLayout snapshot={snapshot} />;
}
