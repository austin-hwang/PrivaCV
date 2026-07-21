"use client";

import * as React from "react";
import {
  Autocomplete,
  Collection,
  composeRenderProps,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  SearchField,
  Separator,
  useFilter,
  type AutocompleteProps,
  type InputProps,
  type MenuItemProps,
  type MenuProps,
  type MenuSectionProps,
  type SeparatorProps,
} from "react-aria-components";
import { CheckIcon, SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";

function Command({
  className,
  dir,
  style,
  ...props
}: Omit<AutocompleteProps, "className" | "style"> & {
  className?: string;
  dir?: React.HTMLAttributes<HTMLDivElement>["dir"];
  style?: React.CSSProperties;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <div
      data-slot="command"
      dir={dir}
      className={cn(
        "flex size-full flex-col overflow-hidden bg-popover text-popover-foreground",
        className,
      )}
      style={style}
    >
      <Autocomplete {...props} filter={props.filter || contains}>
        {props.children}
      </Autocomplete>
    </div>
  );
}

function CommandInput({
  className,
  "aria-label": ariaLabel,
  ...props
}: InputProps & { "aria-label"?: string }) {
  return (
    <SearchField
      autoFocus
      aria-label={ariaLabel || props.placeholder || "Search"}
      data-slot="command-input-wrapper"
      className="p-2"
    >
      <InputGroup className="h-10! *:data-[slot=input-group-addon]:pl-2!">
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
        <Input
          {...props}
          data-slot="command-input"
          className={cn(
            "w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-search-cancel-button]:hidden",
            className,
          )}
        />
      </InputGroup>
    </SearchField>
  );
}

function CommandList<T extends object>({ className, ...props }: MenuProps<T>) {
  return (
    <Menu
      {...props}
      data-slot="command-list"
      className={cn(
        "max-h-[min(55vh,28rem)] scroll-py-1 overflow-x-hidden overflow-y-auto p-2 outline-none",
        className,
      )}
    />
  );
}

function CommandEmpty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-empty"
      className={cn("px-3 py-8 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CommandGroup<T extends object>({
  className,
  children,
  items,
  heading,
  ...props
}: MenuSectionProps<T> & { heading?: string }) {
  return (
    <MenuSection
      data-slot="command-group"
      className={cn("overflow-hidden p-1 text-foreground", className)}
      {...props}
    >
      {heading ? (
        <Header className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{heading}</Header>
      ) : null}
      <Collection items={items}>{children}</Collection>
    </MenuSection>
  );
}

function CommandSeparator({ className, ...props }: SeparatorProps) {
  return (
    <Separator
      data-slot="command-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function CommandItem<T extends object>({
  className,
  children,
  textValue,
  ...props
}: MenuItemProps<T>) {
  return (
    <MenuItem
      {...props}
      data-slot="command-item"
      className={composeRenderProps(className, (className) =>
        cn(
          "group/command-item relative flex cursor-default items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-hidden select-none data-focused:bg-muted data-focused:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        ),
      )}
      textValue={textValue || (typeof children === "string" ? children : undefined)}
    >
      {composeRenderProps(children, (children, { isSelected }) => (
        <>
          {children}
          {isSelected ? <CheckIcon className="ml-auto" /> : null}
        </>
      ))}
    </MenuItem>
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
  CommandItem,
  CommandShortcut,
};
