const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Maak een Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Statische bestanden serveren
app.use(express.static(path.join(__dirname)));

// Route voor de hoofdpagina
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start de server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
