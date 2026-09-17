import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { mtavruliNodes } from "@/lib/mtavruli"

const buttonVariants = cva(
  "group/button font-heading uppercase tracking-[0.04em] inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-[12.5px] font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_3px_8px_rgba(52,87,213,0.16)] hover:-translate-y-px hover:bg-[#2846b7] hover:shadow-[0_5px_12px_rgba(52,87,213,0.2)] active:translate-y-0 transition-[background-color,box-shadow,transform] duration-150 dark:hover:bg-blue-500",
        outline:
          "border-[#dbe1ec] bg-white text-[#566b7d] hover:border-[#c9d3e3] hover:bg-[#f8faff] hover:text-[#17212b] aria-expanded:bg-[#f8faff] dark:border-input dark:bg-input/30 dark:text-foreground dark:hover:bg-input/50",
        secondary:
          "bg-[#eef2ff] text-[#3457d5] hover:bg-[#e2e9ff] aria-expanded:bg-[#e2e9ff] dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/60",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-900 aria-expanded:bg-slate-100 aria-expanded:text-slate-900 dark:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:border-rose-300 focus-visible:ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60",
        success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-full px-3 text-[11px] in-data-[slot=button-group]:rounded-full has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-full px-3.5 text-[12px] in-data-[slot=button-group]:rounded-full has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-5 text-[13px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs":
          "size-7 rounded-full in-data-[slot=button-group]:rounded-full [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-8 rounded-full in-data-[slot=button-group]:rounded-full",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  // When rendered as a link (render={<Link/>} / <a/>), Base UI needs nativeButton=false
  // to skip button-only semantics and avoid its console warning.
  const renderEl = props.render
  const rendersButton =
    !renderEl || (typeof renderEl !== "function" && renderEl.type === "button")
  return (
    <ButtonPrimitive
      data-slot="button"
      nativeButton={nativeButton ?? rendersButton}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {mtavruliNodes(children)}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
