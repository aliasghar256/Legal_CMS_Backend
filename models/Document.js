const { query } = require('../lib/db');
const path = require('path');
const fs = require('fs').promises;

class Document {
  /**
   * Create a new document
   * @param {Object} documentData - Document information
   * @param {number} [documentData.case_id] - Case ID (optional)
   * @param {string} [documentData.type] - Document type (optional)
   * @param {string} [documentData.file_path] - File path (optional)
   * @param {number} [documentData.uploaded_by] - Lawyer ID who uploaded (optional)
   * @param {string} [documentData.date_uploaded] - Upload date (optional, defaults to current date)
   * @returns {Promise<Object>} Created document data
   */
  static async create(documentData) {
    try {
      const {
        case_id = null,
        type = null,
        file_path = null,
        uploaded_by = null,
        date_uploaded = new Date().toISOString().split('T')[0] // Current date
      } = documentData;

      const result = await query(
        `INSERT INTO documents (case_id, type, file_path, uploaded_by, date_uploaded) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING document_id, case_id, type, file_path, uploaded_by, date_uploaded`,
        [case_id, type, file_path, uploaded_by, date_uploaded]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find document by ID
   * @param {number} document_id - Document ID
   * @returns {Promise<Object|null>} Document data or null if not found
   */
  static async findById(document_id) {
    try {
      const result = await query(
        `SELECT document_id, case_id, type, file_path, uploaded_by, date_uploaded 
         FROM documents WHERE document_id = $1`,
        [document_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find document by ID with related data (case, uploader)
   * @param {number} document_id - Document ID
   * @returns {Promise<Object|null>} Document data with related information
   */
  static async findByIdWithDetails(document_id) {
    try {
      const result = await query(
        `SELECT d.document_id, d.case_id, d.type, d.file_path, d.uploaded_by, d.date_uploaded,
                c.case_number, c.case_type, c.status as case_status,
                l.name as uploaded_by_name, l.email as uploaded_by_email
         FROM documents d
         LEFT JOIN cases c ON d.case_id = c.case_id
         LEFT JOIN lawyers l ON d.uploaded_by = l.lawyer_id
         WHERE d.document_id = $1`,
        [document_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find documents by case ID
   * @param {number} case_id - Case ID
   * @param {number} [limit=50] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Documents data with pagination
   */
  static async findByCaseId(case_id, limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT d.document_id, d.type, d.file_path, d.uploaded_by, d.date_uploaded,
                l.name as uploaded_by_name
         FROM documents d
         LEFT JOIN lawyers l ON d.uploaded_by = l.lawyer_id
         WHERE d.case_id = $1
         ORDER BY d.date_uploaded DESC
         LIMIT $2 OFFSET $3`,
        [case_id, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM documents WHERE case_id = $1',
        [case_id]
      );
      const totalDocuments = parseInt(countResult.rows[0].count);

      return {
        documents: result.rows,
        pagination: {
          limit,
          offset,
          total: totalDocuments,
          hasMore: offset + limit < totalDocuments
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find documents by type
   * @param {string} type - Document type
   * @param {number} [limit=50] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Documents data with pagination
   */
  static async findByType(type, limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT d.document_id, d.case_id, d.file_path, d.uploaded_by, d.date_uploaded,
                c.case_number, c.case_type,
                l.name as uploaded_by_name
         FROM documents d
         LEFT JOIN cases c ON d.case_id = c.case_id
         LEFT JOIN lawyers l ON d.uploaded_by = l.lawyer_id
         WHERE d.type = $1
         ORDER BY d.date_uploaded DESC
         LIMIT $2 OFFSET $3`,
        [type, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM documents WHERE type = $1',
        [type]
      );
      const totalDocuments = parseInt(countResult.rows[0].count);

      return {
        documents: result.rows,
        pagination: {
          limit,
          offset,
          total: totalDocuments,
          hasMore: offset + limit < totalDocuments
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find documents uploaded by a specific lawyer
   * @param {number} lawyer_id - Lawyer ID
   * @param {number} [limit=50] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Documents data with pagination
   */
  static async findByUploader(lawyer_id, limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT d.document_id, d.case_id, d.type, d.file_path, d.date_uploaded,
                c.case_number, c.case_type, c.status as case_status
         FROM documents d
         LEFT JOIN cases c ON d.case_id = c.case_id
         WHERE d.uploaded_by = $1
         ORDER BY d.date_uploaded DESC
         LIMIT $2 OFFSET $3`,
        [lawyer_id, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM documents WHERE uploaded_by = $1',
        [lawyer_id]
      );
      const totalDocuments = parseInt(countResult.rows[0].count);

      return {
        documents: result.rows,
        pagination: {
          limit,
          offset,
          total: totalDocuments,
          hasMore: offset + limit < totalDocuments
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find documents by date range
   * @param {string} start_date - Start date (YYYY-MM-DD)
   * @param {string} end_date - End date (YYYY-MM-DD)
   * @param {number} [limit=100] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Documents data with pagination
   */
  static async findByDateRange(start_date, end_date, limit = 100, offset = 0) {
    try {
      const result = await query(
        `SELECT d.document_id, d.case_id, d.type, d.file_path, d.uploaded_by, d.date_uploaded,
                c.case_number, c.case_type,
                l.name as uploaded_by_name
         FROM documents d
         LEFT JOIN cases c ON d.case_id = c.case_id
         LEFT JOIN lawyers l ON d.uploaded_by = l.lawyer_id
         WHERE d.date_uploaded BETWEEN $1 AND $2
         ORDER BY d.date_uploaded DESC
         LIMIT $3 OFFSET $4`,
        [start_date, end_date, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM documents WHERE date_uploaded BETWEEN $1 AND $2',
        [start_date, end_date]
      );
      const totalDocuments = parseInt(countResult.rows[0].count);

      return {
        documents: result.rows,
        pagination: {
          limit,
          offset,
          total: totalDocuments,
          hasMore: offset + limit < totalDocuments
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all documents with pagination and filtering
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [type] - Filter by document type (optional)
   * @param {number} [case_id] - Filter by case ID (optional)
   * @param {number} [uploaded_by] - Filter by uploader (optional)
   * @returns {Promise<Object>} Documents data with pagination info
   */
  static async findAll(limit = 50, offset = 0, type = null, case_id = null, uploaded_by = null) {
    try {
      let sql = `SELECT d.document_id, d.case_id, d.type, d.file_path, d.uploaded_by, d.date_uploaded,
                        c.case_number, c.case_type,
                        l.name as uploaded_by_name
                 FROM documents d
                 LEFT JOIN cases c ON d.case_id = c.case_id
                 LEFT JOIN lawyers l ON d.uploaded_by = l.lawyer_id`;
      let params = [];
      let conditions = [];
      let paramCount = 1;

      if (type) {
        conditions.push(`d.type = $${paramCount}`);
        params.push(type);
        paramCount++;
      }

      if (case_id) {
        conditions.push(`d.case_id = $${paramCount}`);
        params.push(case_id);
        paramCount++;
      }

      if (uploaded_by) {
        conditions.push(`d.uploaded_by = $${paramCount}`);
        params.push(uploaded_by);
        paramCount++;
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ` ORDER BY d.date_uploaded DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM documents d';
      let countParams = [];
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove limit and offset
      }

      const countResult = await query(countSql, countParams);
      const totalDocuments = parseInt(countResult.rows[0].count);

      return {
        documents: result.rows,
        pagination: {
          limit,
          offset,
          total: totalDocuments,
          hasMore: offset + limit < totalDocuments
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update document
   * @param {number} document_id - Document ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated document data or null if not found
   */
  static async update(document_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['case_id', 'type', 'file_path', 'uploaded_by'];

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(document_id);
      const result = await query(
        `UPDATE documents SET ${fields.join(', ')} WHERE document_id = $${paramCount} 
         RETURNING document_id, case_id, type, file_path, uploaded_by, date_uploaded`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete document (also removes file from filesystem)
   * @param {number} document_id - Document ID
   * @param {boolean} [deleteFile=true] - Whether to delete the physical file
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(document_id, deleteFile = true) {
    try {
      // Get document info first to get file path
      const document = await this.findById(document_id);
      if (!document) {
        return false;
      }

      // Delete from database
      const result = await query(
        'DELETE FROM documents WHERE document_id = $1 RETURNING document_id',
        [document_id]
      );

      const deleted = result.rows.length > 0;

      // Delete physical file if requested and path exists
      if (deleted && deleteFile && document.file_path) {
        try {
          await fs.unlink(document.file_path);
        } catch (fileError) {
          console.warn(`Could not delete file: ${document.file_path}`, fileError.message);
          // Don't throw error for file deletion failure
        }
      }

      return deleted;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique document types
   * @returns {Promise<Array>} Array of unique document types
   */
  static async getAllTypes() {
    try {
      const result = await query(
        'SELECT DISTINCT type FROM documents WHERE type IS NOT NULL ORDER BY type'
      );
      return result.rows.map(row => row.type);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get recently uploaded documents
   * @param {number} [days=7] - Number of days to look back
   * @param {number} [limit=20] - Number of records to return
   * @returns {Promise<Array>} Array of recent documents
   */
  static async getRecentDocuments(days = 7, limit = 20) {
    try {
      const result = await query(
        `SELECT d.document_id, d.case_id, d.type, d.file_path, d.uploaded_by, d.date_uploaded,
                c.case_number, c.case_type,
                l.name as uploaded_by_name
         FROM documents d
         LEFT JOIN cases c ON d.case_id = c.case_id
         LEFT JOIN lawyers l ON d.uploaded_by = l.lawyer_id
         WHERE d.date_uploaded >= (CURRENT_DATE - INTERVAL '${days} days')
         ORDER BY d.date_uploaded DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get document statistics
   * @returns {Promise<Object>} Document statistics
   */
  static async getStatistics() {
    try {
      const [totalResult, todayResult, weekResult, typeStatsResult] = await Promise.all([
        query('SELECT COUNT(*) as count FROM documents'),
        query('SELECT COUNT(*) as count FROM documents WHERE date_uploaded = CURRENT_DATE'),
        query('SELECT COUNT(*) as count FROM documents WHERE date_uploaded >= (CURRENT_DATE - INTERVAL \'7 days\')'),
        query('SELECT type, COUNT(*) as count FROM documents WHERE type IS NOT NULL GROUP BY type ORDER BY count DESC LIMIT 5')
      ]);

      return {
        total_documents: parseInt(totalResult.rows[0].count),
        uploaded_today: parseInt(todayResult.rows[0].count),
        uploaded_this_week: parseInt(weekResult.rows[0].count),
        top_types: typeStatsResult.rows
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search documents by filename or type
   * @param {string} searchTerm - Search term
   * @param {number} [limit=50] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Search results with pagination
   */
  static async search(searchTerm, limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT d.document_id, d.case_id, d.type, d.file_path, d.uploaded_by, d.date_uploaded,
                c.case_number, c.case_type,
                l.name as uploaded_by_name
         FROM documents d
         LEFT JOIN cases c ON d.case_id = c.case_id
         LEFT JOIN lawyers l ON d.uploaded_by = l.lawyer_id
         WHERE d.file_path ILIKE $1 OR d.type ILIKE $1
         ORDER BY d.date_uploaded DESC
         LIMIT $2 OFFSET $3`,
        [`%${searchTerm}%`, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM documents WHERE file_path ILIKE $1 OR type ILIKE $1',
        [`%${searchTerm}%`]
      );
      const totalDocuments = parseInt(countResult.rows[0].count);

      return {
        documents: result.rows,
        pagination: {
          limit,
          offset,
          total: totalDocuments,
          hasMore: offset + limit < totalDocuments
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get document size and metadata (if file exists)
   * @param {number} document_id - Document ID
   * @returns {Promise<Object|null>} Document metadata or null
   */
  static async getFileMetadata(document_id) {
    try {
      const document = await this.findById(document_id);
      if (!document || !document.file_path) {
        return null;
      }

      try {
        const stats = await fs.stat(document.file_path);
        const ext = path.extname(document.file_path).toLowerCase();
        
        return {
          ...document,
          file_size: stats.size,
          file_size_mb: (stats.size / (1024 * 1024)).toFixed(2),
          file_extension: ext,
          file_modified: stats.mtime,
          file_exists: true
        };
      } catch (fileError) {
        return {
          ...document,
          file_exists: false,
          error: 'File not found'
        };
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk delete documents by case ID
   * @param {number} case_id - Case ID
   * @param {boolean} [deleteFiles=true] - Whether to delete physical files
   * @returns {Promise<number>} Number of documents deleted
   */
  static async deleteByCaseId(case_id, deleteFiles = true) {
    try {
      // Get all documents for the case first
      const documents = await query(
        'SELECT document_id, file_path FROM documents WHERE case_id = $1',
        [case_id]
      );

      // Delete from database
      const result = await query(
        'DELETE FROM documents WHERE case_id = $1',
        [case_id]
      );

      // Delete physical files if requested
      if (deleteFiles && documents.rows.length > 0) {
        for (const doc of documents.rows) {
          if (doc.file_path) {
            try {
              await fs.unlink(doc.file_path);
            } catch (fileError) {
              console.warn(`Could not delete file: ${doc.file_path}`, fileError.message);
            }
          }
        }
      }

      return result.rowCount;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Document;
