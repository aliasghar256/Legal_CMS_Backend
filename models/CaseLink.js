const { query } = require('../lib/db');

class CaseLink {
  /**
   * Create a new case link
   * @param {Object} linkData - Case link data
   * @param {number} [linkData.parent_case_id] - Parent case ID (optional)
   * @param {number} [linkData.child_case_id] - Child case ID (optional)
   * @param {string} [linkData.link_type] - Link type (optional)
   * @param {string} [linkData.notes] - Notes about the link (optional)
   * @returns {Promise<Object>} Created case link
   */
  static async create({ parent_case_id = null, child_case_id = null, link_type = null, notes = null }) {
    try {
      if (!parent_case_id && !child_case_id) {
        throw new Error('At least one case ID (parent or child) is required');
      }

      if (parent_case_id === child_case_id) {
        throw new Error('A case cannot be linked to itself');
      }

      // Check if this link already exists
      if (parent_case_id && child_case_id) {
        const existing = await this.findByIds(parent_case_id, child_case_id);
        if (existing) {
          throw new Error('This case link already exists');
        }
      }

      const result = await query(
        `INSERT INTO case_links (parent_case_id, child_case_id, link_type, notes) 
         VALUES ($1, $2, $3, $4) 
         RETURNING link_id, parent_case_id, child_case_id, link_type, notes, created_at`,
        [parent_case_id, child_case_id, link_type, notes]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find case link by ID
   * @param {number} link_id - Link ID
   * @returns {Promise<Object|null>} Case link or null if not found
   */
  static async findById(link_id) {
    try {
      const result = await query(
        'SELECT link_id, parent_case_id, child_case_id, link_type, notes, created_at FROM case_links WHERE link_id = $1',
        [link_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find case link by parent and child case IDs
   * @param {number} parent_case_id - Parent case ID
   * @param {number} child_case_id - Child case ID
   * @returns {Promise<Object|null>} Case link or null if not found
   */
  static async findByIds(parent_case_id, child_case_id) {
    try {
      const result = await query(
        'SELECT link_id, parent_case_id, child_case_id, link_type, notes, created_at FROM case_links WHERE parent_case_id = $1 AND child_case_id = $2',
        [parent_case_id, child_case_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all child cases for a parent case
   * @param {number} parent_case_id - Parent case ID
   * @returns {Promise<Array>} Array of child cases with link details
   */
  static async getChildCases(parent_case_id) {
    try {
      const result = await query(
        `SELECT cl.link_id, cl.parent_case_id, cl.child_case_id, cl.link_type, cl.notes, cl.created_at,
                c.case_number as child_case_number, c.case_type as child_case_type, 
                c.status as child_status, c.filing_date as child_filing_date,
                c.court_name as child_court_name
         FROM case_links cl
         INNER JOIN cases c ON cl.child_case_id = c.case_id
         WHERE cl.parent_case_id = $1
         ORDER BY cl.created_at DESC`,
        [parent_case_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all parent cases for a child case
   * @param {number} child_case_id - Child case ID
   * @returns {Promise<Array>} Array of parent cases with link details
   */
  static async getParentCases(child_case_id) {
    try {
      const result = await query(
        `SELECT cl.link_id, cl.parent_case_id, cl.child_case_id, cl.link_type, cl.notes, cl.created_at,
                c.case_number as parent_case_number, c.case_type as parent_case_type, 
                c.status as parent_status, c.filing_date as parent_filing_date,
                c.court_name as parent_court_name
         FROM case_links cl
         INNER JOIN cases c ON cl.parent_case_id = c.case_id
         WHERE cl.child_case_id = $1
         ORDER BY cl.created_at DESC`,
        [child_case_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all links for a specific case (both as parent and child)
   * @param {number} case_id - Case ID
   * @returns {Promise<Object>} Object containing parent_links and child_links arrays
   */
  static async getAllLinksForCase(case_id) {
    try {
      const parentLinks = await this.getChildCases(case_id);
      const childLinks = await this.getParentCases(case_id);

      return {
        as_parent: parentLinks,
        as_child: childLinks,
        total_links: parentLinks.length + childLinks.length
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all case links with pagination and filtering
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [link_type] - Filter by link type (optional)
   * @returns {Promise<Object>} Case links with pagination info
   */
  static async findAll(limit = 50, offset = 0, link_type = null) {
    try {
      let sql = `SELECT cl.link_id, cl.parent_case_id, cl.child_case_id, cl.link_type, cl.notes, cl.created_at,
                        c1.case_number as parent_case_number, c1.case_type as parent_case_type,
                        c2.case_number as child_case_number, c2.case_type as child_case_type
                 FROM case_links cl
                 LEFT JOIN cases c1 ON cl.parent_case_id = c1.case_id
                 LEFT JOIN cases c2 ON cl.child_case_id = c2.case_id`;
      
      let params = [];
      let paramCount = 1;

      if (link_type) {
        sql += ' WHERE cl.link_type = $' + paramCount;
        params.push(link_type);
        paramCount++;
      }

      sql += ' ORDER BY cl.created_at DESC LIMIT $' + paramCount + ' OFFSET $' + (paramCount + 1);
      params.push(limit, offset);

      const result = await query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM case_links';
      let countParams = [];
      if (link_type) {
        countSql += ' WHERE link_type = $1';
        countParams.push(link_type);
      }

      const countResult = await query(countSql, countParams);
      const totalLinks = parseInt(countResult.rows[0].count);

      return {
        links: result.rows,
        pagination: {
          limit,
          offset,
          total: totalLinks,
          hasMore: offset + limit < totalLinks
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update case link
   * @param {number} link_id - Link ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated case link or null if not found
   */
  static async update(link_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (['parent_case_id', 'child_case_id', 'link_type', 'notes'].includes(key) && updates[key] !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Validate that parent and child are not the same
      if (updates.parent_case_id && updates.child_case_id && updates.parent_case_id === updates.child_case_id) {
        throw new Error('A case cannot be linked to itself');
      }

      values.push(link_id);
      const result = await query(
        `UPDATE case_links SET ${fields.join(', ')} WHERE link_id = $${paramCount} 
         RETURNING link_id, parent_case_id, child_case_id, link_type, notes, created_at`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete case link
   * @param {number} link_id - Link ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(link_id) {
    try {
      const result = await query(
        'DELETE FROM case_links WHERE link_id = $1 RETURNING link_id',
        [link_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all links for a specific case
   * @param {number} case_id - Case ID
   * @returns {Promise<number>} Number of links deleted
   */
  static async deleteByCase(case_id) {
    try {
      const result = await query(
        'DELETE FROM case_links WHERE parent_case_id = $1 OR child_case_id = $1 RETURNING link_id',
        [case_id]
      );
      return result.rows.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique link types
   * @returns {Promise<Array>} Array of unique link types
   */
  static async getAllLinkTypes() {
    try {
      const result = await query(
        'SELECT DISTINCT link_type FROM case_links WHERE link_type IS NOT NULL ORDER BY link_type'
      );
      return result.rows.map(row => row.link_type);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get links by type
   * @param {string} link_type - Link type
   * @returns {Promise<Array>} Array of links with specified type
   */
  static async findByType(link_type) {
    try {
      const result = await query(
        `SELECT cl.link_id, cl.parent_case_id, cl.child_case_id, cl.link_type, cl.notes, cl.created_at,
                c1.case_number as parent_case_number, c1.case_type as parent_case_type,
                c2.case_number as child_case_number, c2.case_type as child_case_type
         FROM case_links cl
         LEFT JOIN cases c1 ON cl.parent_case_id = c1.case_id
         LEFT JOIN cases c2 ON cl.child_case_id = c2.case_id
         WHERE cl.link_type = $1
         ORDER BY cl.created_at DESC`,
        [link_type]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get case link statistics
   * @returns {Promise<Object>} Link statistics
   */
  static async getStatistics() {
    try {
      const totalLinksResult = await query('SELECT COUNT(*) as total_links FROM case_links');
      
      const linkTypeStatsResult = await query(
        `SELECT link_type, COUNT(*) as count 
         FROM case_links 
         WHERE link_type IS NOT NULL 
         GROUP BY link_type 
         ORDER BY count DESC`
      );

      const mostLinkedCasesResult = await query(
        `SELECT case_id, case_number, link_count
         FROM (
           SELECT parent_case_id as case_id, COUNT(*) as link_count
           FROM case_links 
           WHERE parent_case_id IS NOT NULL
           GROUP BY parent_case_id
           UNION ALL
           SELECT child_case_id as case_id, COUNT(*) as link_count
           FROM case_links 
           WHERE child_case_id IS NOT NULL
           GROUP BY child_case_id
         ) combined
         INNER JOIN cases c ON combined.case_id = c.case_id
         ORDER BY link_count DESC
         LIMIT 10`
      );

      return {
        total_links: parseInt(totalLinksResult.rows[0].total_links),
        by_type: linkTypeStatsResult.rows,
        most_linked_cases: mostLinkedCasesResult.rows
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find circular links (cases that are linked in a circular manner)
   * @returns {Promise<Array>} Array of circular link groups
   */
  static async findCircularLinks() {
    try {
      const result = await query(
        `SELECT cl1.parent_case_id as case1, cl1.child_case_id as case2,
                c1.case_number as case1_number, c2.case_number as case2_number
         FROM case_links cl1
         INNER JOIN case_links cl2 ON cl1.parent_case_id = cl2.child_case_id 
                                   AND cl1.child_case_id = cl2.parent_case_id
         INNER JOIN cases c1 ON cl1.parent_case_id = c1.case_id
         INNER JOIN cases c2 ON cl1.child_case_id = c2.case_id
         WHERE cl1.parent_case_id < cl1.child_case_id
         ORDER BY cl1.parent_case_id`
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk create case links
   * @param {Array} links - Array of link objects
   * @returns {Promise<Array>} Array of created links
   */
  static async bulkCreate(links) {
    try {
      if (!Array.isArray(links) || links.length === 0) {
        throw new Error('Links array is required and cannot be empty');
      }

      const values = [];
      const placeholders = [];
      let paramCount = 1;

      links.forEach((link, index) => {
        if (!link.parent_case_id && !link.child_case_id) {
          throw new Error(`Link at index ${index}: At least one case ID is required`);
        }
        
        if (link.parent_case_id === link.child_case_id) {
          throw new Error(`Link at index ${index}: A case cannot be linked to itself`);
        }
        
        placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3})`);
        values.push(
          link.parent_case_id || null,
          link.child_case_id || null,
          link.link_type || null,
          link.notes || null
        );
        paramCount += 4;
      });

      const result = await query(
        `INSERT INTO case_links (parent_case_id, child_case_id, link_type, notes) 
         VALUES ${placeholders.join(', ')} 
         RETURNING link_id, parent_case_id, child_case_id, link_type, notes, created_at`,
        values
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CaseLink;
