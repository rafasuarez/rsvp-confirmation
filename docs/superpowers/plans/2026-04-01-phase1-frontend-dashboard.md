# Phase 1 Frontend Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js 14 admin dashboard (login, events list, event detail, guest list, CSV import, responses table) wired to the existing Express API.

**Architecture:** Next.js 14 App Router with `(auth)` and `(dashboard)` route groups. A proxy rewrite forwards `/api/v1/*` to the Express server on port 3001 in dev, keeping all fetches same-origin. shadcn/ui components are added as source files (Radix UI + CVA dependencies already installed). All dashboard routes are guarded by `middleware.ts` which checks for the `connect.sid` cookie. Data fetching uses `fetch` with `credentials: 'include'` inside Client Components.

**Tech Stack:** Next.js 14 App Router, TypeScript 5, shadcn/ui (Radix UI + class-variance-authority + tailwind-merge), lucide-react, Zod 3, vitest

---

## File Map

**New files:**
- `apps/web/src/middleware.ts` — redirects unauthenticated requests to `/login`
- `apps/web/src/lib/api.ts` — typed fetch wrapper + named API endpoint functions
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/input.tsx`
- `apps/web/src/components/ui/label.tsx`
- `apps/web/src/components/ui/card.tsx`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/ui/table.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/separator.tsx`
- `apps/web/src/components/ui/textarea.tsx`
- `apps/web/src/components/ui/select.tsx`
- `apps/web/src/components/ui/toast.tsx`
- `apps/web/src/components/ui/toaster.tsx`
- `apps/web/src/components/ui/use-toast.ts`
- `apps/web/src/components/status-badge.tsx` — maps ConversationStep → colored badge label
- `apps/web/src/components/layout/app-shell.tsx` — sidebar + content wrapper
- `apps/web/src/app/(dashboard)/layout.tsx` — provides AppShell + logout
- `apps/web/src/app/(dashboard)/events/page.tsx` — events list + New Event dialog
- `apps/web/src/app/(dashboard)/events/[eventId]/page.tsx` — event detail: stats + guest list + actions
- `apps/web/src/app/(dashboard)/events/[eventId]/guests/import/page.tsx` — CSV import wizard
- `apps/web/src/app/(dashboard)/events/[eventId]/responses/page.tsx` — responses table + filter + export

**Modified files:**
- `apps/web/package.json` — add `@radix-ui/react-select`, `@radix-ui/react-separator`
- `apps/web/next.config.ts` — add dev API proxy rewrites
- `apps/web/tailwind.config.ts` — extend with CSS variable color tokens + borderRadius
- `apps/web/src/app/globals.css` — add full shadcn/ui CSS variable set
- `apps/web/src/app/(auth)/login/page.tsx` — wire form to `POST /api/v1/auth/login`

---

## Task 1: Foundation — packages, config, CSS, middleware

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/middleware.ts`

- [ ] **Step 1: Add missing Radix UI packages to `apps/web/package.json`**

In `apps/web/package.json`, add to `"dependencies"`:
```json
"@radix-ui/react-select": "^2.0.0",
"@radix-ui/react-separator": "^1.0.3"
```

- [ ] **Step 2: Add API proxy rewrite to `apps/web/next.config.ts`**

Replace the entire file:
```ts
import type { NextConfig } from 'next'

const API_URL = process.env.API_URL ?? 'http://localhost:3001'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    typedRoutes: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_URL}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 3: Update `apps/web/tailwind.config.ts` with CSS variable theme**

Replace the entire file:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 4: Replace `apps/web/src/app/globals.css` with full shadcn/ui variable set**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
}
```

- [ ] **Step 5: Create `apps/web/src/middleware.ts`**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (isPublic) return NextResponse.next()

  const hasSession = request.cookies.has('connect.sid')
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: Install new packages**

```bash
cd apps/web && pnpm install
```

Expected: `@radix-ui/react-select` and `@radix-ui/react-separator` appear in `node_modules`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/next.config.ts apps/web/tailwind.config.ts \
  apps/web/src/app/globals.css apps/web/src/middleware.ts pnpm-lock.yaml
git commit -m "feat(web): shadcn/ui foundation — CSS vars, tailwind theme, API proxy, auth middleware"
```

---

## Task 2: shadcn/ui Base Components

**Files:**
- Create: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/label.tsx`
- Create: `apps/web/src/components/ui/card.tsx`
- Create: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/separator.tsx`
- Create: `apps/web/src/components/ui/textarea.tsx`

- [ ] **Step 1: Create `apps/web/src/components/ui/button.tsx`**

```tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

- [ ] **Step 2: Create `apps/web/src/components/ui/input.tsx`**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
```

- [ ] **Step 3: Create `apps/web/src/components/ui/label.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

- [ ] **Step 4: Create `apps/web/src/components/ui/card.tsx`**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

- [ ] **Step 5: Create `apps/web/src/components/ui/badge.tsx`**

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-100 text-green-800',
        warning: 'border-transparent bg-orange-100 text-orange-800',
        info: 'border-transparent bg-blue-100 text-blue-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

- [ ] **Step 6: Create `apps/web/src/components/ui/separator.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from '@/lib/utils'

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      className,
    )}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
```

- [ ] **Step 7: Create `apps/web/src/components/ui/textarea.tsx`**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: No errors (or only errors in existing files, not the new components).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ui/button.tsx apps/web/src/components/ui/input.tsx \
  apps/web/src/components/ui/label.tsx apps/web/src/components/ui/card.tsx \
  apps/web/src/components/ui/badge.tsx apps/web/src/components/ui/separator.tsx \
  apps/web/src/components/ui/textarea.tsx
git commit -m "feat(web): add shadcn/ui base components — Button, Input, Label, Card, Badge, Separator, Textarea"
```

---

## Task 3: shadcn/ui Interaction Components

**Files:**
- Create: `apps/web/src/components/ui/table.tsx`
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/toast.tsx`
- Create: `apps/web/src/components/ui/toaster.tsx`
- Create: `apps/web/src/components/ui/use-toast.ts`

- [ ] **Step 1: Create `apps/web/src/components/ui/table.tsx`**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
  ),
)
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  ),
)
TableBody.displayName = 'TableBody'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn('h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  ),
)
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  ),
)
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  ),
)
TableCaption.displayName = 'TableCaption'

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption }
```

- [ ] **Step 2: Create `apps/web/src/components/ui/dialog.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </DialogClose>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
}
```

- [ ] **Step 3: Create `apps/web/src/components/ui/select.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent,
  SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton,
}
```

- [ ] **Step 4: Create `apps/web/src/components/ui/use-toast.ts`**

```ts
'use client'

import * as React from 'react'

type ToastVariant = 'default' | 'destructive'

export type Toast = {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
}

type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string }

type ToastState = { toasts: Toast[] }

const listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }

function dispatch(action: ToastAction) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((l) => l(memoryState))
}

function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return { toasts: [action.toast, ...state.toasts].slice(0, 3) }
    case 'REMOVE':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) }
  }
}

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return String(count)
}

export function toast(props: Omit<Toast, 'id'>) {
  const id = genId()
  dispatch({ type: 'ADD', toast: { id, ...props } })
  setTimeout(() => dispatch({ type: 'REMOVE', id }), 4000)
  return id
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const idx = listeners.indexOf(setState)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return { toasts: state.toasts, toast, dismiss: (id: string) => dispatch({ type: 'REMOVE', id }) }
}
```

- [ ] **Step 5: Create `apps/web/src/components/ui/toast.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitive.Provider
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]',
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border bg-background text-foreground',
        destructive: 'destructive group border-destructive bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
))
Toast.displayName = ToastPrimitive.Root.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600',
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
))
ToastClose.displayName = ToastPrimitive.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
))
ToastTitle.displayName = ToastPrimitive.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn('text-sm opacity-90', className)} {...props} />
))
ToastDescription.displayName = ToastPrimitive.Description.displayName

export type { VariantProps }
export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose }
```

- [ ] **Step 6: Create `apps/web/src/components/ui/toaster.tsx`**

```tsx
'use client'

import {
  Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport,
} from '@/components/ui/toast'
import { useToast } from '@/components/ui/use-toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant }) => (
        <Toast key={id} variant={variant}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: No errors in the new component files.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/ui/
git commit -m "feat(web): add shadcn/ui interaction components — Table, Dialog, Select, Toast"
```

---

## Task 4: API Client

**Files:**
- Create: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Create `apps/web/src/lib/api.ts`**

```ts
// All types mirrored from the Express backend responses.
// API base is empty in production (same host); override with API_URL in dev via Next.js rewrites.

export type AdminUser = {
  id: string
  email: string
  name: string
}

export type Event = {
  id: string
  name: string
  slug: string
  eventDate: string
  venue: string | null
  description: string | null
  isActive: boolean
  adminUserId: string
  waPhoneNumberId: string | null
  createdAt: string
  updatedAt: string
}

export type Guest = {
  id: string
  eventId: string
  name: string
  phone: string
  email: string | null
  language: string
  isActive: boolean
  importBatch: string | null
  createdAt: string
  updatedAt: string
}

export type GuestRow = {
  name: string
  phone: string
  email: string | null
  language: string
}

export type ImportPreview = {
  valid: GuestRow[]
  invalid: { row: number; rawPhone: string; reason: string }[]
  duplicatePhones: { row: number; phone: string }[]
  importBatch: string
}

export type GuestResponseRow = {
  guestId: string
  name: string
  phone: string
  email: string | null
  conversationState: string
  isAttending: boolean | null
  confirmedPartySize: number | null
  dietaryNotes: string | null
  submittedAt: string | null
}

export type StatsResult = {
  total: number
  attending: number
  declined: number
  pending: number
  optedOut: number
  unreachable: number
  complete: number
}

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }
type PaginatedResponse<T> = {
  success: true
  data: T[]
  meta: { total: number; page: number; limit: number }
}

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  const body: ApiResponse<T> = await res.json()

  if (!body.success) {
    throw new Error((body as { success: false; error: string }).error ?? `HTTP ${res.status}`)
  }

  return (body as { success: true; data: T }).data
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<AdminUser>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    fetchApi<undefined>('/api/v1/auth/logout', { method: 'POST' }),

  me: () => fetchApi<AdminUser>('/api/v1/auth/me'),
}

// ── Events ────────────────────────────────────────────────────────────────────

export const eventsApi = {
  list: () => fetchApi<Event[]>('/api/v1/events'),

  get: (eventId: string) => fetchApi<Event>(`/api/v1/events/${eventId}`),

  create: (body: { name: string; eventDate: string; venue?: string; description?: string }) =>
    fetchApi<Event>('/api/v1/events', { method: 'POST', body: JSON.stringify(body) }),

  update: (
    eventId: string,
    body: Partial<{ name: string; eventDate: string; venue: string; description: string }>,
  ) =>
    fetchApi<Event>(`/api/v1/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  launch: (eventId: string) =>
    fetchApi<{ queued: number }>(`/api/v1/events/${eventId}/launch`, { method: 'POST' }),
}

// ── Guests ────────────────────────────────────────────────────────────────────

export const guestsApi = {
  list: (eventId: string) =>
    fetchApi<Guest[]>(`/api/v1/events/${eventId}/guests`),

  previewImport: async (eventId: string, file: File): Promise<ImportPreview> => {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`/api/v1/events/${eventId}/guests/import`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    if (res.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const body: ApiResponse<ImportPreview> = await res.json()
    if (!body.success) throw new Error((body as { success: false; error: string }).error)
    return (body as { success: true; data: ImportPreview }).data
  },

  confirmImport: (eventId: string, importBatch: string, guests: GuestRow[]) =>
    fetchApi<{ imported: number; skipped: number }>(
      `/api/v1/events/${eventId}/guests/import/confirm`,
      { method: 'POST', body: JSON.stringify({ importBatch, guests }) },
    ),
}

// ── RSVP ──────────────────────────────────────────────────────────────────────

export const rsvpApi = {
  stats: (eventId: string) =>
    fetchApi<StatsResult>(`/api/v1/events/${eventId}/responses/stats`),

  list: async (
    eventId: string,
    params: { page?: number; limit?: number; status?: string },
  ): Promise<{ rows: GuestResponseRow[]; total: number; page: number; limit: number }> => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.status) qs.set('status', params.status)

    const res = await fetch(
      `/api/v1/events/${eventId}/responses?${qs.toString()}`,
      { credentials: 'include' },
    )

    if (res.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const body: PaginatedResponse<GuestResponseRow> = await res.json()
    return {
      rows: body.data,
      total: body.meta.total,
      page: body.meta.page,
      limit: body.meta.limit,
    }
  },

  exportUrl: (eventId: string) => `/api/v1/events/${eventId}/responses/export`,
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add typed API client with all endpoint functions"
```

---

## Task 5: App Shell + Dashboard Layout + Status Badge

**Files:**
- Create: `apps/web/src/components/status-badge.tsx`
- Create: `apps/web/src/components/layout/app-shell.tsx`
- Create: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/src/app/layout.tsx` — add Toaster

- [ ] **Step 1: Create `apps/web/src/components/status-badge.tsx`**

```tsx
import { Badge } from '@/components/ui/badge'

// Maps ConversationStep + isAttending to a planner-friendly label + badge color
type StatusBadgeProps = {
  state: string
  isAttending?: boolean | null
}

const STATE_CONFIG: Record<
  string,
  { label: string; variant: 'secondary' | 'info' | 'warning' | 'success' | 'destructive' | 'outline' }
> = {
  PENDING:             { label: 'Sin contactar',           variant: 'secondary' },
  INITIAL_SENT:        { label: 'Mensaje enviado',         variant: 'info' },
  AWAITING_ATTENDANCE: { label: 'Esperando respuesta',     variant: 'warning' },
  AWAITING_COMPANIONS: { label: 'Esperando acompañantes',  variant: 'warning' },
  AWAITING_DIETARY:    { label: 'Esperando dietética',     variant: 'warning' },
  OPT_OUT:             { label: 'Baja voluntaria',         variant: 'secondary' },
  UNREACHABLE:         { label: 'No alcanzable',           variant: 'destructive' },
}

export function StatusBadge({ state, isAttending }: StatusBadgeProps) {
  if (state === 'COMPLETE') {
    return isAttending
      ? <Badge variant="success">Confirmado</Badge>
      : <Badge variant="destructive">Declinado</Badge>
  }

  const config = STATE_CONFIG[state] ?? { label: state, variant: 'outline' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
```

- [ ] **Step 2: Create `apps/web/src/components/layout/app-shell.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { authApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/events', label: 'Eventos', icon: CalendarDays },
]

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await authApi.logout()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r bg-card">
        {/* Logo */}
        <div className="px-6 py-5">
          <span className="text-lg font-semibold tracking-tight">RSVP Manager</span>
          <p className="text-xs text-muted-foreground mt-0.5">Panel de control</p>
        </div>

        <Separator />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <Separator />

        {/* Logout */}
        <div className="p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Create `apps/web/src/app/(dashboard)/layout.tsx`**

```tsx
import { AppShell } from '@/components/layout/app-shell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
```

- [ ] **Step 4: Add Toaster to root layout `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RSVP Manager — Wedding Planner',
  description: 'Gestión de confirmaciones de asistencia por WhatsApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/status-badge.tsx \
  apps/web/src/components/layout/app-shell.tsx \
  apps/web/src/app/\(dashboard\)/layout.tsx \
  apps/web/src/app/layout.tsx
git commit -m "feat(web): add AppShell sidebar layout, dashboard layout, StatusBadge"
```

---

## Task 6: Login Page — wire form to API

**Files:**
- Modify: `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace `apps/web/src/app/(auth)/login/page.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    const password = form.get('password') as string

    try {
      await authApi.login(email, password)
      const redirect = searchParams.get('redirect') ?? '/events'
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm space-y-6 p-8 bg-card rounded-xl shadow-sm border">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">RSVP Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de confirmaciones de asistencia
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="nombre@ejemplo.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </Button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Manual smoke test (optional but recommended)**

Start both servers:
```bash
# Terminal 1 (from repo root):
docker compose up -d
cd apps/api && pnpm dev

# Terminal 2:
cd apps/web && pnpm dev
```

Open http://localhost:3000, confirm redirect to `/login`, attempt login with bad credentials → see error, log in with correct credentials → redirect to `/events`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(auth\)/login/page.tsx
git commit -m "feat(web): wire login form to POST /api/v1/auth/login"
```

---

## Task 7: Events List Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/events/page.tsx`

- [ ] **Step 1: Create `apps/web/src/app/(dashboard)/events/page.tsx`**

This page shows all events and includes a "New Event" dialog with a form.

```tsx
'use client'

import { useState, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { CalendarDays, Plus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { eventsApi, type Event } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    eventsApi.list()
      .then(setEvents)
      .catch(() => toast({ title: 'Error', description: 'No se pudieron cargar los eventos', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)

    const form = new FormData(e.currentTarget)
    const dateValue = form.get('eventDate') as string

    try {
      const newEvent = await eventsApi.create({
        name: form.get('name') as string,
        eventDate: new Date(dateValue).toISOString(),
        venue: (form.get('venue') as string) || undefined,
        description: (form.get('description') as string) || undefined,
      })
      setEvents((prev) => [newEvent, ...prev])
      setDialogOpen(false)
      toast({ title: 'Evento creado', description: newEvent.name })
    } catch (err) {
      toast({
        title: 'Error al crear evento',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Eventos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tus bodas y campañas de RSVP
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo evento
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Cargando…</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-card">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Aún no tienes eventos</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea tu primer evento para comenzar a gestionar RSVPs
          </p>
          <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo evento
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex items-center justify-between p-5 border rounded-lg bg-card hover:bg-accent/50 transition-colors group"
            >
              <div>
                <p className="font-medium">{event.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatDate(event.eventDate)}
                  {event.venue && ` · ${event.venue}`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {/* New Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo evento</DialogTitle>
            <DialogDescription>
              Completa los datos de la boda. Podrás editar estos detalles más adelante.
            </DialogDescription>
          </DialogHeader>

          <form id="create-event-form" onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre del evento *</Label>
              <Input id="name" name="name" required placeholder="Boda de Ana y Carlos" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eventDate">Fecha de la boda *</Label>
              <Input id="eventDate" name="eventDate" type="date" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="venue">Lugar (opcional)</Label>
              <Input id="venue" name="venue" placeholder="Hotel Gran Melia, Madrid" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Notas (opcional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Información adicional para el equipo…"
                rows={3}
              />
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button type="submit" form="create-event-form" disabled={creating}>
              {creating ? 'Creando…' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/events/page.tsx
git commit -m "feat(web): events list page with New Event dialog"
```

---

## Task 8: Event Detail Page

Shows stats cards, guest list with status badges, and action buttons (launch campaign, import, view responses).

**Files:**
- Create: `apps/web/src/app/(dashboard)/events/[eventId]/page.tsx`

- [ ] **Step 1: Create `apps/web/src/app/(dashboard)/events/[eventId]/page.tsx`**

```tsx
'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Send, BarChart3, Users, CheckCircle2, XCircle, Clock, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/status-badge'
import { eventsApi, guestsApi, rsvpApi, type Event, type Guest, type StatsResult } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

type StatCardProps = { label: string; value: number; icon: React.ReactNode; color?: string }

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className={color}>{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const router = useRouter()

  const [event, setEvent] = useState<Event | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [stats, setStats] = useState<StatsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    Promise.all([
      eventsApi.get(eventId),
      guestsApi.list(eventId),
      rsvpApi.stats(eventId),
    ])
      .then(([ev, gs, st]) => {
        setEvent(ev)
        setGuests(gs)
        setStats(st)
      })
      .catch(() =>
        toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' }),
      )
      .finally(() => setLoading(false))
  }, [eventId])

  async function handleLaunch() {
    setLaunching(true)
    try {
      const result = await eventsApi.launch(eventId)
      setLaunchDialogOpen(false)
      toast({
        title: 'Campaña enviada',
        description: `Se han enviado mensajes a ${result.queued} invitados.`,
      })
      // Refresh stats
      const newStats = await rsvpApi.stats(eventId)
      setStats(newStats)
    } catch (err) {
      toast({
        title: 'Error al lanzar campaña',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setLaunching(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">Cargando…</div>
    )
  }

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Evento no encontrado.</p>
        <Button variant="link" onClick={() => router.push('/events')}>
          Volver a eventos
        </Button>
      </div>
    )
  }

  const pendingGuests = guests.filter((g) => g.isActive).length
  const canLaunch = pendingGuests > 0

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Breadcrumb + header */}
      <div>
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todos los eventos
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{event.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(event.eventDate)}
              {event.venue && ` · ${event.venue}`}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/events/${eventId}/guests/import`}>
                <Upload className="h-4 w-4 mr-2" />
                Importar invitados
              </Link>
            </Button>
            <Button
              onClick={() => setLaunchDialogOpen(true)}
              disabled={!canLaunch}
              title={!canLaunch ? 'No hay invitados pendientes' : undefined}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar RSVP
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total invitados"
            value={stats.total}
            icon={<Users className="h-4 w-4" />}
            color="text-muted-foreground"
          />
          <StatCard
            label="Confirmados"
            value={stats.attending}
            icon={<CheckCircle2 className="h-4 w-4" />}
            color="text-green-600"
          />
          <StatCard
            label="Declinados"
            value={stats.declined}
            icon={<XCircle className="h-4 w-4" />}
            color="text-red-500"
          />
          <StatCard
            label="Sin respuesta"
            value={stats.pending}
            icon={<Clock className="h-4 w-4" />}
            color="text-orange-500"
          />
        </div>
      )}

      {/* Guest list + responses link */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Invitados ({guests.length})</h2>
          {guests.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/events/${eventId}/responses`}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Ver respuestas
              </Link>
            </Button>
          )}
        </div>

        {guests.length === 0 ? (
          <div className="border rounded-lg p-10 text-center bg-card">
            <UserX className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Sin invitados todavía</p>
            <p className="text-xs text-muted-foreground mt-1">
              Importa una lista CSV para comenzar
            </p>
            <Button size="sm" variant="outline" className="mt-4" asChild>
              <Link href={`/events/${eventId}/guests/import`}>
                <Upload className="h-4 w-4 mr-2" />
                Importar invitados
              </Link>
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell className="font-medium">{guest.name}</TableCell>
                    <TableCell className="text-muted-foreground">{guest.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{guest.email ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge state="PENDING" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Launch confirmation dialog */}
      <Dialog open={launchDialogOpen} onOpenChange={setLaunchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Enviar mensajes RSVP?</DialogTitle>
            <DialogDescription>
              Estás a punto de enviar mensajes de WhatsApp a{' '}
              <strong>{pendingGuests} invitados</strong>. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchDialogOpen(false)} disabled={launching}>
              Cancelar
            </Button>
            <Button onClick={handleLaunch} disabled={launching}>
              {launching ? 'Enviando…' : 'Sí, enviar mensajes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/events/\[eventId\]/page.tsx
git commit -m "feat(web): event detail page — stats, guest list, launch campaign dialog"
```

---

## Task 9: CSV Import Page

Three-step wizard: 1) Upload CSV file → 2) Preview valid/invalid rows → 3) Confirm import.

**Files:**
- Create: `apps/web/src/app/(dashboard)/events/[eventId]/guests/import/page.tsx`

- [ ] **Step 1: Create `apps/web/src/app/(dashboard)/events/[eventId]/guests/import/page.tsx`**

```tsx
'use client'

import { useState, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { guestsApi, type ImportPreview } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'

type Step = 'upload' | 'preview' | 'done'

export default function ImportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const data = await guestsApi.previewImport(eventId, file)
      setPreview(data)
      setStep('preview')
    } catch (err) {
      toast({
        title: 'Error al procesar el archivo',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setConfirming(true)

    try {
      const result = await guestsApi.confirmImport(eventId, preview.importBatch, preview.valid)
      setImportResult(result)
      setStep('done')
    } catch (err) {
      toast({
        title: 'Error al confirmar importación',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al evento
        </Link>
        <h1 className="text-2xl font-semibold">Importar invitados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sube un archivo CSV con la lista de invitados.
        </p>
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 1 — Selecciona el archivo CSV</CardTitle>
            <CardDescription>
              El archivo debe tener columnas: <code className="text-xs bg-muted px-1 rounded">first_name</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">last_name</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">phone</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">email</code> (opcional).
              El teléfono se normaliza automáticamente a formato internacional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="csv-file"
              className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">
                {uploading ? 'Procesando…' : 'Haz clic para seleccionar un archivo'}
              </span>
              <span className="text-xs text-muted-foreground mt-1">CSV hasta 5MB</span>
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          {/* Summary badges */}
          <div className="flex gap-3 flex-wrap">
            <Badge variant="success" className="text-sm px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              {preview.valid.length} válidos
            </Badge>
            {preview.invalid.length > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                {preview.invalid.length} con errores
              </Badge>
            )}
            {preview.duplicatePhones.length > 0 && (
              <Badge variant="warning" className="text-sm px-3 py-1">
                {preview.duplicatePhones.length} duplicados
              </Badge>
            )}
          </div>

          {/* Valid rows */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Invitados válidos ({preview.valid.length})
              </CardTitle>
              <CardDescription>
                Estos invitados serán importados al confirmar.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {preview.valid.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Sin invitados válidos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono (E.164)</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.valid.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell>{g.name}</TableCell>
                        <TableCell className="font-mono text-sm">{g.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{g.email ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Invalid rows (if any) */}
          {preview.invalid.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base text-destructive">
                  Filas con errores ({preview.invalid.length}) — No se importarán
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Teléfono ingresado</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.invalid.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell className="font-mono text-sm">{r.rawPhone || '(vacío)'}</TableCell>
                        <TableCell className="text-destructive">{r.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => { setStep('upload'); setPreview(null) }}
              disabled={confirming}
            >
              Subir otro archivo
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming || preview.valid.length === 0}
            >
              {confirming
                ? 'Importando…'
                : `Confirmar importación (${preview.valid.length} invitados)`}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && importResult && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
            <h2 className="text-xl font-semibold">¡Importación completada!</h2>
            <p className="text-muted-foreground mt-2">
              <strong>{importResult.imported}</strong> invitados importados correctamente.
              {importResult.skipped > 0 && (
                <> <strong>{importResult.skipped}</strong> omitidos (ya existían).</>
              )}
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <Button variant="outline" onClick={() => { setStep('upload'); setImportResult(null) }}>
                Importar más
              </Button>
              <Button onClick={() => router.push(`/events/${eventId}`)}>
                Ver lista de invitados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/events/\[eventId\]/guests/import/page.tsx
git commit -m "feat(web): CSV import wizard — upload, preview, confirm steps"
```

---

## Task 10: Responses Page

Paginated table of RSVP responses with status filter and CSV export.

**Files:**
- Create: `apps/web/src/app/(dashboard)/events/[eventId]/responses/page.tsx`

- [ ] **Step 1: Create `apps/web/src/app/(dashboard)/events/[eventId]/responses/page.tsx`**

```tsx
'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import { rsvpApi, type GuestResponseRow, type StatsResult } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'attending', label: 'Confirmados' },
  { value: 'declined', label: 'Declinados' },
  { value: 'pending', label: 'Sin respuesta' },
  { value: 'opted_out', label: 'Baja voluntaria' },
]

const PAGE_SIZE = 50

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function ResponsesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)

  const [rows, setRows] = useState<GuestResponseRow[]>([])
  const [stats, setStats] = useState<StatsResult | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    const statusParam = status === 'all' ? undefined : status

    Promise.all([
      rsvpApi.list(eventId, { page, limit: PAGE_SIZE, status: statusParam }),
      rsvpApi.stats(eventId),
    ])
      .then(([data, st]) => {
        setRows(data.rows)
        setTotal(data.total)
        setStats(st)
      })
      .catch(() =>
        toast({ title: 'Error', description: 'No se pudieron cargar las respuestas', variant: 'destructive' }),
      )
      .finally(() => setLoading(false))
  }, [eventId, page, status])

  function handleStatusChange(value: string) {
    setStatus(value)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al evento
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Respuestas RSVP</h1>
            {stats && (
              <p className="text-sm text-muted-foreground mt-1">
                {stats.attending} confirmados · {stats.declined} declinados · {stats.pending} sin respuesta
                {stats.optedOut > 0 && ` · ${stats.optedOut} bajas`}
              </p>
            )}
          </div>

          <Button variant="outline" asChild>
            <a href={rsvpApi.exportUrl(eventId)} download>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </a>
          </Button>
        </div>
      </div>

      {/* Filter + table */}
      <div className="space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">
            {total} resultado{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acompañantes</TableHead>
                <TableHead>Dietética</TableHead>
                <TableHead>Respuesta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Sin resultados
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.guestId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.phone}</TableCell>
                    <TableCell>
                      <StatusBadge
                        state={row.conversationState}
                        isAttending={row.isAttending}
                      />
                    </TableCell>
                    <TableCell>
                      {row.confirmedPartySize !== null ? row.confirmedPartySize : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {row.dietaryNotes || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.submittedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/events/\[eventId\]/responses/page.tsx
git commit -m "feat(web): responses table — paginated, filterable, CSV export"
```

---

## Task 11: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Build check**

```bash
cd apps/web && pnpm build
```

Expected: Build completes successfully. Standalone output in `.next/standalone`.

- [ ] **Step 3: Run full stack locally and smoke test all flows**

```bash
# Terminal 1:
docker compose up -d
cd apps/api && pnpm dev

# Terminal 2:
cd apps/web && pnpm dev
```

Test checklist:
- [ ] `/` → redirects to `/login`
- [ ] Login with wrong credentials → error message shown
- [ ] Login with correct credentials → redirected to `/events`
- [ ] Create event via dialog → appears in list
- [ ] Click event → detail page loads with stats (0s if no guests)
- [ ] Import guests → upload CSV → preview shows valid/invalid rows → confirm → success screen
- [ ] Return to event detail → guest count updated
- [ ] Responses page → loads table (may be empty), filter works, CSV export downloads file
- [ ] Logout → redirected to `/login`, `/events` redirect back to `/login`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(web): Phase 1 frontend complete — login, events, guests, import, responses"
```

---

## Self-Review

**Spec coverage:**
- ✅ Admin login/logout (Task 6)
- ✅ Create/view events (Task 7)
- ✅ Import guests via CSV with preview/confirm (Task 9)
- ✅ View guest list with status badges (Task 8)
- ✅ Launch campaign with confirmation (Task 8)
- ✅ View RSVP responses table (Task 10)
- ✅ Export responses as CSV (Task 10)
- ✅ Status filter on responses (Task 10)

**Notes:**
- Conversation history view per guest is deferred (not in Phase 1 spec — spec says "can click any guest to see conversation history" but this is listed as Phase 1 optional; a follow-up task can add a modal)
- The guest list on the Event Detail page shows `PENDING` state for all guests since the `Guest` model doesn't include `conversationState` in `listGuests` — this is accurate since a freshly imported guest has no conversation state yet. The responses page uses `GuestResponseRow` which includes the state.
