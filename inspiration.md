# Daily Report Automation - Design System & Aesthetic Codes

This document contains all the core design aesthetic codes used throughout the Daily Report Automation System. Copy and paste these into your project for a cohesive, premium internal tool aesthetic.

---

## 1. CSS Custom Properties & Color Palette

Add this to your `:root` selector in your main CSS file:

```css
:root {
  /* Primary Colors - Green Accent */
  --primary: oklch(0.55 0.22 142.5);
  --primary-foreground: oklch(0.98 0 0);
  
  /* Sidebar Colors */
  --sidebar-primary: oklch(0.55 0.22 142.5);
  --sidebar-primary-foreground: oklch(0.98 0 0);
  
  /* Chart Colors (Green Gradient) */
  --chart-1: oklch(0.55 0.22 142.5);
  --chart-2: oklch(0.6 0.2 142.5);
  --chart-3: oklch(0.5 0.25 142.5);
  --chart-4: oklch(0.45 0.23 142.5);
  --chart-5: oklch(0.4 0.2 142.5);
  
  /* Spacing & Radius */
  --radius: 0.75rem;
  
  /* Background & Text */
  --background: oklch(0.98 0.001 0);
  --foreground: oklch(0.2 0.01 0);
  
  /* Cards & Surfaces */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.2 0.01 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.2 0.01 0);
  
  /* Semantic Colors */
  --secondary: oklch(0.95 0.005 0);
  --secondary-foreground: oklch(0.3 0.01 0);
  --muted: oklch(0.93 0.003 0);
  --muted-foreground: oklch(0.55 0.01 0);
  --accent: oklch(0.55 0.22 142.5);
  --accent-foreground: oklch(0.98 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  
  /* Borders & Inputs */
  --border: oklch(0.91 0.002 0);
  --input: oklch(0.98 0.001 0);
  --ring: oklch(0.55 0.22 142.5);
  
  /* Sidebar Specific */
  --sidebar: oklch(0.98 0.001 0);
  --sidebar-foreground: oklch(0.2 0.01 0);
  --sidebar-accent: oklch(0.55 0.22 142.5);
  --sidebar-accent-foreground: oklch(0.98 0 0);
  --sidebar-border: oklch(0.91 0.002 0);
  --sidebar-ring: oklch(0.55 0.22 142.5);
}
```

---

## 2. Typography & Fonts

Import these fonts in your HTML `<head>` or CSS:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
```

CSS for typography:

```css
body {
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Playfair Display', serif;
  font-weight: 600;
  letter-spacing: -0.02em;
}

h1 { font-size: 2.25rem; font-weight: 700; }
h2 { font-size: 1.875rem; font-weight: 700; }
h3 { font-size: 1.5rem; font-weight: 600; }
```

---

## 3. Component Classes

### Soft Shadow (Elevation)
```css
.soft-shadow {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}
```

### Green Glowing Dot (Calendar Indicator)
```css
.glow-dot {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
  box-shadow: 
    0 0 20px rgba(34, 197, 94, 0.6),
    0 0 40px rgba(34, 197, 94, 0.3),
    inset 0 1px 2px rgba(255, 255, 255, 0.5);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### Card Elevated (Premium Cards)
```css
.card-elevated {
  background-color: var(--card);
  color: var(--card-foreground);
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
  transition: all 300ms ease-out;
}

.card-elevated:hover {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
```

### Button Primary (Green Gradient)
```css
.button-primary {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  background: linear-gradient(to right, #22c55e, #16a34a);
  color: white;
  font-weight: 500;
  transition: all 300ms ease-out;
  border: none;
  cursor: pointer;
}

.button-primary:hover {
  box-shadow: 0 10px 15px -3px rgba(34, 197, 94, 0.3);
}

.button-primary:active {
  transform: scale(0.95);
}

.button-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Button Secondary (Muted)
```css
.button-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  background-color: var(--muted);
  color: var(--foreground);
  font-weight: 500;
  transition: all 300ms ease-out;
  border: none;
  cursor: pointer;
}

.button-secondary:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.button-secondary:active {
  transform: scale(0.95);
}
```

### Input Field (Form Inputs)
```css
.input-field {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  background-color: var(--input);
  color: var(--foreground);
  transition: all 200ms ease-out;
  font-size: 1rem;
}

.input-field::placeholder {
  color: var(--muted-foreground);
}

.input-field:focus {
  outline: none;
  ring: 2px;
  ring-color: var(--accent);
  border-color: transparent;
}
```

### Sidebar Navigation Item
```css
.sidebar-nav-item {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 200ms ease-out;
  cursor: pointer;
}

.sidebar-nav-item:hover {
  background-color: var(--muted);
}

.sidebar-nav-item.active {
  background-color: var(--accent);
  color: var(--accent-foreground);
}
```

---

## 4. Animations & Transitions

```css
/* Smooth Transition Utility */
.transition-smooth {
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Fade In Animation */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.fade-in {
  animation: fadeIn 300ms ease-out;
}

/* Slide In From Right (Panel Open) */
@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.slide-in-right {
  animation: slideInRight 400ms ease-out;
}

/* Slide Out To Right (Panel Close) */
@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.slide-out-right {
  animation: slideOutRight 400ms ease-out;
}

/* Pulse Glow (Calendar Indicator) */
@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
```

---

## 5. Layout Utilities

```css
/* Container with Responsive Padding */
.container {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1rem;
  padding-right: 1rem;
}

@media (min-width: 640px) {
  .container {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .container {
    padding-left: 2rem;
    padding-right: 2rem;
    max-width: 1280px;
  }
}

/* Flex with Min-Width/Height Reset */
.flex {
  display: flex;
  min-width: 0;
  min-height: 0;
}

/* Grid Gap Utility */
.gap-2 { gap: 0.5rem; }
.gap-3 { gap: 0.75rem; }
.gap-4 { gap: 1rem; }
.gap-6 { gap: 1.5rem; }

/* Spacing Utilities */
.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.p-8 { padding: 2rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-8 { margin-bottom: 2rem; }
```

---

## 6. Dark Mode (Optional)

If you want to add dark mode support, add this to your CSS:

```css
.dark {
  --primary: oklch(0.55 0.22 142.5);
  --primary-foreground: oklch(0.98 0 0);
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.85 0.005 65);
  --card: oklch(0.21 0.006 285.885);
  --card-foreground: oklch(0.85 0.005 65);
  --muted: oklch(0.274 0.006 286.033);
  --muted-foreground: oklch(0.705 0.015 286.067);
  --border: rgb(255 255 255 / 10%);
  --input: rgb(255 255 255 / 15%);
}
```

---

## 7. Quick Reference: Color Values

| Element | Color | Use Case |
|---------|-------|----------|
| Primary/Accent | `#22c55e` (Green) | Buttons, highlights, active states |
| Background | `#fafafa` (Off-white) | Page background |
| Card | `#ffffff` (White) | Cards, panels, surfaces |
| Text | `#1a1a1a` (Dark Gray) | Primary text |
| Muted | `#ededed` (Light Gray) | Secondary backgrounds, borders |
| Border | `#e8e8e8` (Subtle Gray) | Dividers, borders |
| Destructive | `#ef4444` (Red) | Delete, error states |

---

## 8. Usage Examples

### Example 1: Premium Card
```html
<div class="card-elevated p-6">
  <h3 class="text-xl font-semibold mb-2">Card Title</h3>
  <p class="text-muted-foreground">Card content goes here</p>
</div>
```

### Example 2: Button Group
```html
<div class="flex gap-3">
  <button class="button-primary">Submit</button>
  <button class="button-secondary">Cancel</button>
</div>
```

### Example 3: Form Input
```html
<label class="block text-sm font-medium mb-2">Label</label>
<input type="text" class="input-field" placeholder="Enter text...">
```

### Example 4: Glowing Calendar Indicator
```html
<button class="relative">
  <span class="relative z-10">12</span>
  <div class="glow-dot"></div>
</button>
```

### Example 5: Sidebar Navigation
```html
<nav class="space-y-2">
  <button class="sidebar-nav-item active w-full text-left">Dashboard</button>
  <button class="sidebar-nav-item w-full text-left">Reports</button>
  <button class="sidebar-nav-item w-full text-left">Settings</button>
</nav>
```

---

## 9. Design Principles

**Aesthetic Philosophy:**
- **Soothing**: Soft gradients, subtle shadows, generous spacing
- **Modern**: Clean typography, rounded corners, smooth transitions
- **Professional**: Premium feel with intentional hierarchy and contrast
- **Accessible**: High contrast text, clear focus states, readable fonts

**Key Design Rules:**
1. Always pair background colors with appropriate foreground text colors
2. Use the green accent (`#22c55e`) sparingly for emphasis and CTAs
3. Maintain consistent spacing using the `--radius` variable
4. Apply soft shadows for depth, not harsh borders
5. Use smooth transitions (300ms) for all interactive elements
6. Keep animations subtle and purposeful (2-4 seconds for loops)

---

## 10. Tailwind CSS Integration (If Using Tailwind)

If you're using Tailwind CSS, add this to your `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'oklch(0.55 0.22 142.5)',
        accent: 'oklch(0.55 0.22 142.5)',
        muted: 'oklch(0.93 0.003 0)',
      },
      borderRadius: {
        DEFAULT: '0.75rem',
      },
      boxShadow: {
        soft: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
        glow: '0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
};
```

---

## Summary

This design system provides a complete, cohesive aesthetic for a premium internal tool. The green accent color, soft shadows, smooth animations, and elegant typography create a soothing yet professional environment. Copy these codes into your project and customize as needed!
