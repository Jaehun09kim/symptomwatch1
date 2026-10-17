"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Like useActionState, but submits via onSubmit so React does not reset the
 * form after the action runs — a rejected submission keeps what the user typed.
 */
export function useFormAction<State>(
  action: (previous: Awaited<State>, form: FormData) => State | Promise<State>,
  initial: Awaited<State>,
) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => dispatch(form));
  };
  return [state, onSubmit, pending] as const;
}
