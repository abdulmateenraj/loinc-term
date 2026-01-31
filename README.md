# LOINC Browser

A modern, web-based user interface for browsing and querying LOINC (Logical Observation Identifiers Names and Codes) terminology using FHIR Terminology Services.

## 🌟 Features

- **Code Lookup** - Look up detailed information about any LOINC code including properties, designations, and translations
- **Code Validation** - Validate if a code exists in the LOINC system
- **Concept Search** - Search for LOINC codes by term or filter
- **Subsumption Testing** - Test hierarchical relationships between LOINC codes
- **Multi-language Support** - View translations in multiple languages (English, German, Spanish, French, etc.)
- **Export Options** - Copy or download results as JSON
- **Search History** - Quick access to recently searched codes
- **Responsive Design** - Works on desktop and mobile devices

## 🚀 Live Demo

Visit the live demo at: [https://YOUR_USERNAME.github.io/LOINC-Browser/](https://YOUR_USERNAME.github.io/LOINC-Browser/)

## 🔧 Default Server

The browser is pre-configured to connect to:
```
http://84.8.248.255:8080/fhir
```

This is a HAPI FHIR server running Snowstorm X with LOINC terminology loaded.

## 📦 Installation

### GitHub Pages (Recommended)

1. Fork this repository
2. Go to Settings → Pages
3. Select "Deploy from a branch" 
4. Choose `main` branch and `/ (root)` folder
5. Click Save
6. Your site will be available at `https://YOUR_USERNAME.github.io/LOINC-Browser/`

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/LOINC-Browser.git
cd LOINC-Browser
```

2. Serve the files using any static file server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve

# Using PHP
php -S localhost:8000
```

3. Open `http://localhost:8000` in your browser

## 🛠️ FHIR Operations Supported

### CodeSystem $lookup
Look up details for a LOINC code:
```
GET /CodeSystem/$lookup?system=http://loinc.org&code=4544-3
```

### CodeSystem $validate-code
Validate if a code exists:
```
GET /CodeSystem/$validate-code?system=http://loinc.org&code=4544-3
```

### ValueSet $expand
Search for concepts:
```
GET /ValueSet/$expand?url=http://loinc.org&filter=glucose
```

### CodeSystem $subsumes
Test hierarchical relationships:
```
GET /CodeSystem/$subsumes?system=http://loinc.org&codeA=LP7057-5&codeB=LP7057-5
```

## 🎨 Customization

### Changing the Default Server

Edit `app.js` and modify the `CONFIG` object:

```javascript
const CONFIG = {
    defaultServer: 'https://your-fhir-server.com/fhir',
    loincSystem: 'http://loinc.org',
    timeout: 30000,
    maxHistoryItems: 20
};
```

### Styling

The application uses CSS custom properties (variables) for easy theming. Edit `styles.css` to customize:

```css
:root {
    --primary-color: #2563eb;
    --bg-color: #f8fafc;
    /* ... other variables */
}
```

## 📋 Project Structure

```
LOINC-Browser/
├── index.html          # Main HTML file
├── styles.css          # Stylesheet
├── app.js              # JavaScript application
├── worker.js           # Service worker
├── README.md           # This file
└── LICENSE             # License file
```

## 🔗 Related Links

- [LOINC.org](https://loinc.org) - Official LOINC website
- [Terminologies.tech](https://www.terminologies.tech) - Parent project
- [FHIR Terminology Services](https://www.hl7.org/fhir/terminology-service.html) - FHIR specification

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- LOINC® is a registered trademark of Regenstrief Institute, Inc.
- Built with ❤️ for the healthcare informatics community

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
