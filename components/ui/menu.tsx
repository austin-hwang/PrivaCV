"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type MenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  triggerId: string;
};

const MenuContext = React.createContext<MenuContextValue | null>(null);

function useMenu() {
  const context = React.useContext(MenuContext);
  if (!context) throw new Error("Menu components must be used within <Menu>");
  return context;
}

/**
 * Lightweight click-away dropdown. Kept dependency-free (no extra Radix package)
 * since the menu only holds secondary toolbar actions.
 */
export function Menu({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();
  const contentId = `menu-content-${menuId}`;
  const triggerId = `menu-trigger-${menuId}`;

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <MenuContext.Provider value={{ open, setOpen, contentId, triggerId }}>
      <div ref={ref} className={cn("relative", className)}>
        {children}
      </div>
    </MenuContext.Provider>
  );
}

export function MenuTrigger({
  children,
}: {
  children: React.ReactElement<{
    id?: string;
    onClick?: (event: React.MouseEvent) => void;
    onKeyDown?: (event: React.KeyboardEvent) => void;
    "aria-controls"?: string;
    "aria-expanded"?: boolean;
    "aria-haspopup"?: boolean;
  }>;
}) {
  const { open, setOpen, contentId, triggerId } = useMenu();
  return React.cloneElement(children, {
    id: children.props.id ?? triggerId,
    "aria-haspopup": true,
    "aria-expanded": open,
    "aria-controls": open ? contentId : undefined,
    onClick: (event: React.MouseEvent) => {
      children.props.onClick?.(event);
      setOpen(!open);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      children.props.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
    },
  });
}

export function MenuContent({ children, className, align = "end" }: { children: React.ReactNode; className?: string; align?: "start" | "end" }) {
  const { open, setOpen, contentId, triggerId } = useMenu();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    contentRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open]);

  if (!open) return null;

  const moveFocus = (current: HTMLElement, direction: 1 | -1) => {
    const items = Array.from(current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(currentIndex + direction + items.length) % items.length]?.focus();
  };

  return (
    <div
      ref={contentRef}
      id={contentId}
      role="menu"
      aria-labelledby={triggerId}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(event.currentTarget, 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(event.currentTarget, -1);
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          const items = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
          items[event.key === "Home" ? 0 : items.length - 1]?.focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          document.getElementById(triggerId)?.focus();
        } else if (event.key === "Tab") {
          setOpen(false);
        }
      }}
      className={cn(
        "absolute top-[calc(100%+0.375rem)] z-50 min-w-52 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  disabled,
  destructive,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const { setOpen } = useMenu();
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        destructive ? "text-destructive hover:bg-destructive/10 [&_svg]:text-destructive" : "hover:bg-accent hover:text-accent-foreground",
      )}
      onClick={() => {
        setOpen(false);
        onSelect?.();
      }}
    >
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" role="separator" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>;
}
