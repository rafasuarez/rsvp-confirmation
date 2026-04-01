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
        // Status colors matching plan: green/red/orange/grey
        confirmed: '#16a34a',
        declined: '#dc2626',
        pending: '#ea580c',
        'opted-out': '#6b7280',
      },
    },
  },
  plugins: [],
}

export default config
