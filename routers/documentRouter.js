const express = require('express');
const DocumentController = require('../controllers/DocumentController');

const router = express.Router();

// Get all documents
router.get('/', DocumentController.getAllDocuments);

// Get document by ID
router.get('/:id', DocumentController.getDocumentById);

// Create new document
router.post('/', DocumentController.createDocument);

// Update document
router.put('/:id', DocumentController.updateDocument);

// Delete document
router.delete('/:id', DocumentController.deleteDocument);

module.exports = router;
