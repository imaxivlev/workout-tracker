# Dev Server Setup

## Quick Start

To run the development server:

```cmd
cmd.exe /c "npm run dev"
```

**Note:** Direct `npm` and `npx` commands fail due to PowerShell execution policy restrictions. Always use `cmd.exe /c` wrapper.

## Access URL

After starting the server, the app is available at:
- Local: http://localhost:3000
- Workout tracker: http://localhost:3000/workout-tracker/index.html

## Troubleshooting

If port 3000 is in use, Next.js will automatically use port 3001.

If you see lock file errors, terminate any existing `next dev` processes first.
