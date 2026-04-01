import type { ButtonHTMLAttributes } from "react";

/** Font Awesome 6 solid icon as an accessible control (label via title + aria-label). */
export function IconButton({
  icon,
  label,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center ${className}`}
      {...rest}
    >
      <i className={`fa-solid ${icon}`} aria-hidden />
    </button>
  );
}
