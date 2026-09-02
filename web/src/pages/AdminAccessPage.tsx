import { Layout } from "../components/Layout";
import { AdminAccessPanel } from "../components/AdminAccessPanel";

export function AdminAccessPage() {
  return (
    <Layout isAdmin>
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-bob-ink md:text-2xl">
          Admin access
        </h1>
        <p className="mt-1 text-sm text-bob-muted">
          Grant or remove admin for members who have signed in.
        </p>
      </div>
      <section className="surface-glass p-4">
        <AdminAccessPanel />
      </section>
    </Layout>
  );
}
