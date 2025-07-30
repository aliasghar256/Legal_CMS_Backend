const Document = require('../models/Document');

class DocumentController {
  // Get all documents
  static async getAllDocuments(req, res) {
    try {
      const { page = 1, limit = 50, type, case_id, uploaded_by } = req.query;
      const offset = (page - 1) * limit;
      
      const result = await Document.findAll(
        parseInt(limit), 
        parseInt(offset), 
        type, 
        case_id ? parseInt(case_id) : null,
        uploaded_by ? parseInt(uploaded_by) : null
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getAllDocuments:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get document by ID
  static async getDocumentById(req, res) {
    try {
      const documentId = parseInt(req.params.id);
      
      if (isNaN(documentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document ID'
        });
      }
      
      const documentData = await Document.findById(documentId);
      
      if (!documentData) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }
      
      res.json({
        success: true,
        data: documentData
      });
    } catch (error) {
      console.error('Error in getDocumentById:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create new document
  static async createDocument(req, res) {
    try {
      const documentData = req.body;
      
      const newDocument = await Document.create(documentData);
      
      res.status(201).json({
        success: true,
        message: 'Document created successfully',
        data: newDocument
      });
    } catch (error) {
      console.error('Error in createDocument:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update document
  static async updateDocument(req, res) {
    try {
      const documentId = parseInt(req.params.id);
      const updateData = req.body;
      
      if (isNaN(documentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document ID'
        });
      }
      
      const updatedDocument = await Document.update(documentId, updateData);
      
      if (!updatedDocument) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Document updated successfully',
        data: updatedDocument
      });
    } catch (error) {
      console.error('Error in updateDocument:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete document
  static async deleteDocument(req, res) {
    try {
      const documentId = parseInt(req.params.id);
      
      if (isNaN(documentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document ID'
        });
      }
      
      const deleted = await Document.delete(documentId);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteDocument:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = DocumentController;
