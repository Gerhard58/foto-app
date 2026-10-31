import Link from "next/link";
import { requireAdmin } from "../../guard";
import RoundForm from "../RoundForm";

export default async function NewRoundPage() {
  await requireAdmin();
  return (
    <>
      <p className="small"><Link href="/admin">← Admin</Link></p>
      <h1>Neue Runde</h1>
      <RoundForm />
    </>
  );
}
