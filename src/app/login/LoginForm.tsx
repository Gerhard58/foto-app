"use client";

import { useActionState } from "react";
import { signIn } from "../actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  if (state?.ok) return <p className="msg-ok">{state.message}</p>;
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email">E-Mail-Adresse</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      {state && !state.ok && <ul className="errors">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="actions">
        <button disabled={pending}>{pending ? "Wird gesendet …" : "Anmeldelink senden"}</button>
      </div>
    </form>
  );
}
