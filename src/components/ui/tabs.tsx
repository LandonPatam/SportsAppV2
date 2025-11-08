import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

/* ------------------------------ Tabs List ------------------------------ */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // === Rounded, glassy container ===
      "inline-flex w-full max-w-lg items-center justify-center rounded-full bg-muted/40 p-1 shadow-inner backdrop-blur-sm transition-all duration-300",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

/* ----------------------------- Tabs Trigger ---------------------------- */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      `
      relative flex-1 rounded-full px-4 py-2 text-sm font-semibold
      text-muted-foreground transition-all duration-300
      hover:scale-[1.05] active:scale-[0.97]
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50
      data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F6EA41] data-[state=active]:to-[#F048C6]
      data-[state=active]:text-white data-[state=active]:shadow-md
      `,
      className
    )}
    {...props}
  >
    {props.children}

    {/* ✨ Subtle glowing overlay for active tab */}
    <span
      className="
        absolute inset-0 rounded-full scale-0 bg-white/10 opacity-0 
        transition-all duration-300 
        data-[state=active]:scale-100 data-[state=active]:opacity-100
      "
      aria-hidden
    />
  </TabsPrimitive.Trigger>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

/* ----------------------------- Tabs Content ---------------------------- */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
