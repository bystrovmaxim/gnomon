"use client";
import type { ButtonHTMLAttributes } from "react";
import "./button.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "secondary" | "primary" | "danger" | "link" | "icon";
};

/** Shared action appearance; the caller owns placement and the action itself. */
export function Button({ variant = "secondary", type = "button", className = "", ...props }: ButtonProps) {
  return <button {...props} type={type} data-variant={variant} className={`mx-button ${className}`.trim()} />;
}
