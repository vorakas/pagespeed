# Lamps Plus Logo Update

## Files Changed:
1. **index.html** - Updated header to include Lamps Plus logo
2. **style.css** - Added styling for the header logo
3. **lampsplus-logo.png** - Logo image file

## Installation Instructions:

### 1. Place the logo image:
Create the directory structure if it doesn't exist:
```
your-app/
├── static/
│   ├── images/          <- Create this folder if it doesn't exist
│   │   └── lampsplus-logo.png   <- Place the logo here
```

Copy `lampsplus-logo.png` to `static/images/lampsplus-logo.png`

### 2. Update the HTML and CSS:
- Copy `index.html` to your `templates/` folder
- Copy `style.css` to your `static/css/` folder

### 3. The header will now display:
```
[LAMPS PLUS LOGO] PageSpeed Insights Monitor
```

## Notes:
- The logo is sized to 60px height and maintains aspect ratio
- The logo displays inline with the text
- Works in both light and dark modes
- Only the main page (index.html) has been updated with the logo
- Other pages still show "📊 PageSpeed Insights Monitor"

If you want the logo on all pages, let me know and I can update the other HTML files as well!
