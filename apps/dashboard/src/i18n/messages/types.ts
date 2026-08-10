import type { en } from "./en";

/**
 * The same tree as `en` with every leaf loosened to plain `string`, so a
 * translation may say something different but may not skip a key, add one, or
 * change a string into anything else. Completeness is enforced by `tsc`, which
 * already gates the workspace.
 */
type Localized<T> = T extends string
  ? string
  : T extends readonly string[]
    ? readonly string[]
    : { readonly [K in keyof T]: Localized<T[K]> };

export type Messages = Localized<typeof en>;

/** One page or component namespace, for locale files that ship per-file. */
export type MessagesFor<N extends keyof Messages> = Messages[N];
