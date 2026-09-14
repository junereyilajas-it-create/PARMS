const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function extractText(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const contentXml = zip.readAsText('word/document.xml');
    
    // Quick regex to extract text between <w:t> tags
    const textMatches = contentXml.match(/<w:t[^>]*>.*?<\/w:t>/g) || [];
    let text = textMatches.map(t => t.replace(/<[^>]+>/g, '')).join(' ');
    
    console.log(`\n--- ${path.basename(filePath)} ---\n`);
    console.log(text);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
}

extractText('C E R T I F I C A T I O N.docx');
extractText('certification2.docx');
extractText('REAL PROPERTY HISTORICAL OWNERSHIP.docx');
