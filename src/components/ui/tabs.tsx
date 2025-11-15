import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

type TabsTheme = "default" | "nfl" | "nba"

const gradientMap: Record<TabsTheme, { from: string; to: string }> = {
  default: { from: "#F6EA41", to: "#F048C6" },
  nfl: { from: "#5e70fbff", to: "#ffc342ff" },
  nba: { from: "#00ffeeff", to: "#cc00ffff" },
}

const TabsGradientContext = React.createContext(gradientMap.default)

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & { theme?: TabsTheme }
>(({ theme = "default", ...props }, ref) => (
  <TabsGradientContext.Provider value={gradientMap[theme] || gradientMap.default}>
    <TabsPrimitive.Root ref={ref} {...props} />
  </TabsGradientContext.Provider>
))
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex w-full max-w-lg items-center justify-center rounded-full bg-muted/40 p-1 shadow-inner backdrop-blur-sm transition-all duration-300",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const gradient = React.useContext(TabsGradientContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        `
        relative flex-1 rounded-full px-4 py-2 text-sm font-semibold
        text-muted-foreground transition-all duration-300
        hover:scale-[1.05] active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50
        data-[state=active]:[background-image:linear-gradient(90deg,var(--tabs-gradient-from),var(--tabs-gradient-to))]
        data-[state=active]:text-white data-[state=active]:shadow-md
        `,
        className
      )}
      style={
        {
          ["--tabs-gradient-from" as string]: gradient.from,
          ["--tabs-gradient-to" as string]: gradient.to,
        } as React.CSSProperties
      }
      {...props}
    >
      {props.children}
      <span
        className="
          absolute inset-0 rounded-full scale-0 bg-white/10 opacity-0
          transition-all duration-300
          data-[state=active]:scale-100 data-[state=active]:opacity-100
        "
        aria-hidden
      />
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

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
