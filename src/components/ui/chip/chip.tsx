import styles from "./chip.module.css";

/*
 * Chip — bracketed, code-style toggle primitive.
 *
 * Visually a `[ label ]` form: when inactive, just the label sits
 * inside a hairline-bordered pill; when active, accent-colored "["
 * and "]" brackets fade in and the border picks up the accent. No
 * fill — the active state is communicated through typesetting, not
 * paint, which suits a mono, monochrome-leaning system.
 *
 * Padding always reserves the bracket's horizontal space, so toggling
 * doesn't shift surrounding layout.
 *
 * This is the shared visual primitive used by the theme toggle on
 * /system and (eventually) the scenario chips on /. All extensions
 * (icons, sizing variants) should land here so consumers stay simple.
 */
export type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Toggled state. Drives both the visual treatment and aria-pressed. */
  active?: boolean;
};

export function Chip({
  children,
  active = false,
  className,
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      className={[styles.chip, className].filter(Boolean).join(" ")}
      data-active={active ? "true" : undefined}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
}
