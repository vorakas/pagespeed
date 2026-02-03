# Favicon Installation

## What's a Favicon?
A favicon is the small icon that appears in browser tabs, bookmarks, and browser history next to your website's title.

## What's Included:
- **favicon.ico** - The icon file with a red circle containing a bar chart and "LP" text
- **favicon-16x16.png** - 16x16 pixel PNG version (preview)
- **favicon-32x32.png** - 32x32 pixel PNG version (preview)

## Design:
- Red circular background (Lamps Plus brand red: #E31837)
- White bar chart icon (representing PageSpeed analytics)
- "LP" text in white (Lamps Plus branding)

## Installation:

### 1. Place the favicon file:
Copy `favicon.ico` to your `static/` folder:
```
your-app/
├── static/
│   └── favicon.ico    <- Place it here
```

### 2. Update HTML files:
All HTML files have been updated with this line in the `<head>` section:
```html
<link rel="icon" type="image/x-icon" href="{{ url_for('static', filename='favicon.ico') }}">
```

### 3. Deploy and test:
- Deploy the updated files
- Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Visit your site and look at the browser tab - you should see the icon!

## Files Updated:
- index.html
- setup.html
- test.html
- metrics.html
- newrelic.html
- iislogs.html

## Note:
If you have a graphic designer at Lamps Plus, they can create a more polished version that perfectly matches your brand guidelines. Just replace the favicon.ico file in the static/ folder.
