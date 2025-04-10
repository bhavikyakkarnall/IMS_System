require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const multer = require('multer');
const csv = require('fast-csv');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'uploads/' });
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultSecret',
  resave: false,
  saveUninitialized: true
}));

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

// ---------------- Authentication Routes ----------------

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND password = ?',
      [email, password]
    );
    if (rows.length > 0) {
      const user = rows[0];
      // Store full name as user.name and include company.
      req.session.user = {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
        address: user.address,
        company: user.company
      };
      res.json({ success: true, message: 'Login successful', user: req.session.user });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err)
      return res.status(500).json({ success: false, message: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.post('/api/register', async (req, res) => {
  const { first_name, last_name, company, address, suburb, city, postal_code, contact_number, email, password } = req.body;
  try {
    await pool.query(
      `INSERT INTO user_requests 
       (first_name, last_name, company, address, suburb, city, postal_code, contact_number, email, password, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, company, address, suburb, city, postal_code, contact_number, email, password, 'pending']
    );
    res.json({ success: true, message: 'Registration request submitted, pending admin approval.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/password-reset', async (req, res) => {
  const { email, new_password } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE users SET password = ? WHERE email = ?',
      [new_password, email]
    );
    if (result.affectedRows > 0)
      res.json({ success: true, message: 'Password updated successfully' });
    else
      res.status(404).json({ success: false, message: 'User not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/home', (req, res) => {
  if (req.session.user)
    res.json({ success: true, message: `Welcome ${req.session.user.name}`, user: req.session.user });
  else
    res.status(401).json({ success: false, message: 'Unauthorized' });
});

// ---------------- Inventory Endpoints ----------------

// /api/inventory/filters now returns only non-blank companies.
app.get('/api/inventory/filters', async (req, res) => {
  try {
    const [statusRows] = await pool.query('SELECT DISTINCT status FROM inventory');
    const [locationRows] = await pool.query('SELECT DISTINCT location FROM inventory');
    const [typeRows] = await pool.query('SELECT DISTINCT type FROM inventory');
    const [poRows] = await pool.query('SELECT DISTINCT po FROM inventory');
    // Return only companies that are not NULL or empty.
    const [companyRows] = await pool.query("SELECT DISTINCT company FROM users WHERE company IS NOT NULL AND company <> ''");
    res.json({
      status: statusRows.map(r => r.status),
      location: locationRows.map(r => r.location),
      type: typeRows.map(r => r.type),
      po: poRows.map(r => r.po),
      company: companyRows.map(r => r.company)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Inventory endpoint with extended filtering.
// For super-admin, admin, and staff, we use a LEFT JOIN with the users table to allow filtering by company.
app.get('/api/inventory', async (req, res) => {
  try {
    const user = req.session.user;
    let baseQuery = '';
    const params = [];

    if (user && ['super-admin', 'admin', 'staff'].includes(user.role)) {
      baseQuery = `
        SELECT i.* FROM inventory i 
        LEFT JOIN users u 
          ON CONCAT(u.first_name, " ", u.last_name) = i.location
        WHERE 1=1
      `;
      if (req.query.search) {
        baseQuery += " AND (i.cs LIKE ? OR i.serial LIKE ? OR i.phone LIKE ?)";
        const term = `%${req.query.search}%`;
        params.push(term, term, term);
      }
      ['status', 'location', 'type', 'po'].forEach(filter => {
        if (req.query[filter]) {
          baseQuery += ` AND i.${filter} = ?`;
          params.push(req.query[filter]);
        }
      });
      if (req.query.company) {
        baseQuery += ' AND u.company = ?';
        params.push(req.query.company);
      }
    } else if (user && user.role === 'company-admin') {
      // For company-admin, show items where location is one of the full names of users in the same company.
      const [companyUsers] = await pool.query(
        'SELECT CONCAT(first_name, " ", last_name) AS name FROM users WHERE company = ?',
        [user.company]
      );
      const companyUserNames = companyUsers.map(u => u.name);
      baseQuery = 'SELECT * FROM inventory WHERE 1=1';
      if (req.query.search) {
        baseQuery += " AND (cs LIKE ? OR serial LIKE ? OR phone LIKE ?)";
        const term = `%${req.query.search}%`;
        params.push(term, term, term);
      }
      ['status', 'location', 'type', 'po'].forEach(filter => {
        if (req.query[filter]) {
          baseQuery += ` AND ${filter} = ?`;
          params.push(req.query[filter]);
        }
      });
      if (companyUserNames.length > 0) {
        baseQuery += ' AND location IN (?)';
        params.push(companyUserNames);
      } else {
        return res.json({ success: true, items: [] });
      }
    } else if (user) {
      // For regular users: show only items where location exactly matches their full name.
      baseQuery = 'SELECT * FROM inventory WHERE 1=1';
      if (req.query.search) {
        baseQuery += " AND (cs LIKE ? OR serial LIKE ? OR phone LIKE ?)";
        const term = `%${req.query.search}%`;
        params.push(term, term, term);
      }
      ['status', 'location', 'type', 'po'].forEach(filter => {
        if (req.query[filter]) {
          baseQuery += ` AND ${filter} = ?`;
          params.push(req.query[filter]);
        }
      });
      baseQuery += ' AND location = ?';
      params.push(user.name);
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const [items] = await pool.query(baseQuery, params);
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error in /api/inventory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search inventory by barcode.
app.get('/api/inventory/search', async (req, res) => {
  const { barcode } = req.query;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM inventory WHERE cs = ? OR serial = ?',
      [barcode, barcode]
    );
    if (rows.length > 0)
      res.json({ success: true, item: rows[0] });
    else
      res.json({ success: false, message: 'Item not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Transit Batch endpoint.
app.post('/api/inventory/transitBatch', async (req, res) => {
  const user = req.session.user;
  const { csList } = req.body;
  if (!user) {
    return res.status(403).json({ success: false, message: 'Unauthorized: Please log in' });
  }
  if (!csList || !Array.isArray(csList) || csList.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid request data' });
  }
  try {
    const placeholders = csList.map(() => '?').join(',');
    const [result] = await pool.query(
      `UPDATE inventory 
       SET status = 'Transit to Office', location = 'Office' 
       WHERE cs IN (${placeholders})`,
      csList
    );
    if (result.affectedRows > 0) {
      res.json({ success: true, message: 'Items updated successfully' });
    } else {
      res.json({ success: false, message: 'No items were updated. Please check the codes.' });
    }
  } catch (err) {
    console.error('Transit Batch Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update inventory item endpoint.
app.put('/api/inventory/:id', async (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const itemId = req.params.id;
  let payload = req.body;
  if (user.role === 'staff') {
    payload = { status: payload.status };
  }
  const fields = Object.keys(payload).map(key => `${key} = ?`).join(', ');
  const values = Object.values(payload);
  values.push(itemId);
  try {
    const [result] = await pool.query(`UPDATE inventory SET ${fields} WHERE id = ?`, values);
    if (result.affectedRows > 0)
      res.json({ success: true, message: 'Item updated successfully' });
    else
      res.status(404).json({ success: false, message: 'Item not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- Comments Endpoints ----------------

app.get('/api/inventory/:id/comments', async (req, res) => {
  const itemId = req.params.id;
  const user = req.session.user;
  if (!user)
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  try {
    if (user.role === 'company-admin') {
      // For company-admin, verify that the item’s location (i.e. assigned user full name)
      // is in the list of users from the same company.
      const [items] = await pool.query('SELECT location FROM inventory WHERE id = ?', [itemId]);
      if (items.length === 0) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }
      const item = items[0];
      const [companyUsers] = await pool.query('SELECT CONCAT(first_name, " ", last_name) AS name FROM users WHERE company = ?', [user.company]);
      const companyUserNames = companyUsers.map(u => u.name);
      if (!companyUserNames.includes(item.location)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const [comments] = await pool.query('SELECT * FROM comments WHERE item_id = ?', [itemId]);
      return res.json({ success: true, comments });
    } else if (['super-admin', 'admin', 'staff'].includes(user.role)) {
      const [comments] = await pool.query('SELECT * FROM comments WHERE item_id = ?', [itemId]);
      return res.json({ success: true, comments });
    } else {
      const [comments] = await pool.query('SELECT * FROM comments WHERE item_id = ? AND user_id = ?', [itemId, user.id]);
      return res.json({ success: true, comments });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/inventory/:id/comments', async (req, res) => {
  const itemId = req.params.id;
  const { comment } = req.body;
  const user = req.session.user;
  if (!user)
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  const visibility = (user.role === 'admin') ? 'admin' : 'user+admin';
  try {
    await pool.query(
      'INSERT INTO comments (item_id, text, user, user_id, visibility) VALUES (?, ?, ?, ?, ?)',
      [itemId, comment, user.name, user.id, visibility]
    );
    res.json({ success: true, message: 'Comment added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- Inventory Receive & Upload Endpoints ----------------

app.post('/api/inventory/receive', async (req, res) => {
  const user = req.session.user;
  const { csList } = req.body;
  if (!user || !['admin', 'super-admin'].includes(user.role)) {
    return res.status(403).json({ success: false, message: 'Unauthorized: Admin privileges required.' });
  }
  if (!csList || !Array.isArray(csList) || csList.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid request data' });
  }
  try {
    const updates = csList.map(cs =>
      pool.query(
        'UPDATE inventory SET location = ?, status = ? WHERE cs = ?',
        ['ADT Security', 'Refurb', cs]
      )
    );
    await Promise.all(updates);
    res.json({ success: true, message: 'Items moved to Warehouse with Storeroom status.' });
  } catch (err) {
    console.error('Receive Error:', err);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// ---------------- Dispatch Endpoint ----------------
app.post('/api/dispatch', async (req, res) => {
  const { techId, items } = req.body;

  try {
    // Retrieve the technician's name based on techId.
    const [techRows] = await pool.query('SELECT first_name, last_name FROM users WHERE id = ?', [techId]);
    if (techRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tech not found' });
    }
    const techName = `${techRows[0].first_name} ${techRows[0].last_name}`;

    // Process each item.
    for (const item of items) {
      // Update the inventory record only if a CS# is provided.
      if (item.cs) {
        await pool.query(
          'UPDATE inventory SET location = ?, status = ? WHERE cs = ?',
          [techName, 'Dispatched', item.cs]
        );
        console.log(`Updated inventory for CS ${item.cs} with location ${techName}`);
      }
    }
    res.json({ success: true, message: 'Dispatch processed; items updated as Dispatched.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



// ---------------- Admin & User Management Endpoints ----------------

function isAdmin(req, res, next) {
  if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'super-admin')) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden. Admin privileges required.' });
  }
}

app.get('/api/users', isAdmin, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users');
    const [requests] = await pool.query('SELECT * FROM user_requests WHERE status = "pending"');
    res.json({ success: true, users, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/users/approve', isAdmin, async (req, res) => {
  const { request_id, role } = req.body;
  try {
    const [requests] = await pool.query('SELECT * FROM user_requests WHERE id = ?', [request_id]);
    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    const requestData = requests[0];
    await pool.query(
      `INSERT INTO users (first_name, last_name, company, address, suburb, city, postal_code, contact_number, email, password, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [requestData.first_name, requestData.last_name, requestData.company, requestData.address, requestData.suburb, requestData.city, requestData.postal_code, requestData.contact_number, requestData.email, requestData.password, role]
    );
    await pool.query('UPDATE user_requests SET status = "approved" WHERE id = ?', [request_id]);
    res.json({ success: true, message: 'User approved and added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/users/reject', isAdmin, async (req, res) => {
  const { request_id } = req.body;
  try {
    await pool.query('UPDATE user_requests SET status = "rejected" WHERE id = ?', [request_id]);
    res.json({ success: true, message: 'User registration rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/users/:id', isAdmin, async (req, res) => {
  const userId = req.params.id;
  const { first_name, last_name, company, address, suburb, city, postal_code, contact_number, email, role } = req.body;
  try {
    await pool.query(
      `UPDATE users SET first_name=?, last_name=?, company=?, address=?, suburb=?, city=?, postal_code=?, contact_number=?, email=?, role=? WHERE id=?`,
      [first_name, last_name, company, address, suburb, city, postal_code, contact_number, email, role, userId]
    );
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/users/:id', isAdmin, async (req, res) => {
  const userId = req.params.id;
  try {
    await pool.query('DELETE FROM users WHERE id=?', [userId]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/users/list', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, first_name, last_name, address, contact_number as contact, email, company FROM users');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/users/company', async (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'company-admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  try {
    const [users] = await pool.query('SELECT id, first_name, last_name, email FROM users WHERE company = ?', [user.company]);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- Start Server ----------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
