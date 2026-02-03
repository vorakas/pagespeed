# Favicon Installation

## What's a Favicon?
A favicon is the small icon that appears in browser tabs, bookmarks, and browser history next to your website's title.

## What's Included:
- **favicon.ico** - The icon file (THIS IS THE ONLY FILE YOU NEED!)
- **favicon-16x16.png** - 16x16 pixel PNG version (PREVIEW ONLY - not needed for deployment)
- **favicon-32x32.png** - 32x32 pixel PNG version (PREVIEW ONLY - not needed for deployment)

## Design:
- Black square background
- Colorful bar chart (blue, green, red bars ascending - like 📊)
- "LP" text in red (Lamps Plus brand red: #E31837)

## Installation:

### 1. Place the favicon file:
Copy **ONLY `favicon.ico`** to your `static/` folder:
```
your-app/
├── static/
│   └── favicon.ico    <- Place ONLY this file here
```

**Note:** The PNG files are just for preview - you don't need to add them to GitHub or deploy them!

### 2. HTML files already updated:
All HTML files already have this line in the `<head>` section:
```html
<link rel="icon" type="image/x-icon" href="{{ url_for('static', filename='favicon.ico') }}">
```

### 3. Deploy and test:
- Add `favicon.ico` to your GitHub repository in the `static/` folder
- Push to GitHub (Railway will auto-deploy)
- Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Visit your site and look at the browser tab - you should see the icon!

## What to Add to GitHub:
- ✅ **favicon.ico** - Add this to `static/` folder
- ❌ **favicon-16x16.png** - NOT needed (preview only)
- ❌ **favicon-32x32.png** - NOT needed (preview only)

## Files Already Updated (from previous update):
- index.html
- setup.html
- test.html
- metrics.html
- newrelic.html
- iislogs.html

## Note:
If you have a graphic designer at Lamps Plus, they can create a more polished version that perfectly matches your brand guidelines. Just replace the favicon.ico file in the static/ folder - no other changes needed!
