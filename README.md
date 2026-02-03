# Side Navigation Implementation

## Overview
This update adds a side navigation menu to the PageSpeed Insights Monitor and restructures the application into separate pages.

## Files Included
1. **index.html** - Main dashboard page (removed Setup section)
2. **setup.html** - Site/URL Setup page (contains only the Setup section)
3. **style.css** - Updated styles with side navigation
4. **app.js** - Unchanged JavaScript functionality
5. **app.py** - Updated Flask routes with /setup endpoint
6. **README.md** - This file

## Key Changes

### 1. Side Navigation Menu
- Fixed left sidebar (280px wide)
- Dark theme styling matching the rest of the app
- "Menu" header in white
- Currently has one link: "Site/URL Setup"
- Highlights active page with green accent
- Responsive hover states

### 2. Layout Structure
```
┌──────────────┬─────────────────────────────────┐
│              │                                 │
│   Side Nav   │      Main Content              │
│   (280px)    │      (Flexible width)          │
│              │                                 │
└──────────────┴─────────────────────────────────┘
```

### 3. Page Structure
- **/** (index.html) - Main dashboard with all sections except Setup
  - Run Tests
  - Core Web Vitals Reference
  - Understanding Lighthouse Scores
  - Latest Results
  - Page Comparison
  - Historical Performance

- **/setup** (setup.html) - Site/URL Setup page
  - Add Site form
  - Add URL form

## Changes to app.py

Added a new route for the setup page:

```python
@app.route('/setup')
def setup():
    """Site/URL Setup page"""
    sites = db.get_sites()
    return render_template('setup.html', sites=sites)
```

**No changes needed to:**
- models.py
- pagespeed_service.py

These files remain exactly as they were.

## File Structure in Your Flask App

```
your-app/
├── app.py (UPDATED)
├── models.py (no changes)
├── pagespeed_service.py (no changes)
├── templates/
│   ├── index.html (NEW VERSION)
│   └── setup.html (NEW FILE)
├── static/
│   ├── css/
│   │   └── style.css (UPDATED)
│   └── js/
│       └── app.js (no changes)
```

## Installation Steps

1. **Back up your current files** (always a good practice!)

2. **Extract the zip file** and copy files to your project:
   - Copy `index.html` and `setup.html` to `templates/` folder
   - Copy `style.css` to `static/css/` folder
   - Copy `app.js` to `static/js/` folder (if you've made local changes, you can skip this)
   - Copy `app.py` to your root directory (or merge the new `/setup` route into your existing app.py)

3. **Test locally** before deploying:
   ```bash
   python app.py
   ```
   - Visit http://localhost:5000 to see the main dashboard
   - Visit http://localhost:5000/setup to see the setup page
   - Test the theme toggle on both pages

4. **Deploy to Railway**:
   - Commit all changes to your Git repository
   - Push to GitHub
   - Railway will automatically rebuild and deploy

## Light Mode Support
The side navigation fully supports light mode toggling:
- Dark mode: Dark gray background (#111827)
- Light mode: White background with gray text
- Active link changes color based on theme (green in dark, purple in light)

## Next Steps
You mentioned adding more links to the menu one at a time. When you're ready for the next link, just let me know:
- What should it be called?
- What sections from the current dashboard should it include?

## Notes
- All existing API endpoints remain unchanged
- Database models remain unchanged
- The PageSpeed service remains unchanged
- Only the routing and template structure has been modified
