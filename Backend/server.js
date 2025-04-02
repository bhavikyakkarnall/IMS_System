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
      // Assume user's assigned location is stored in "address"
      req.session.user = { id: user.id, name: `${user.first_name} ${user.last_name}`, role: user.role, location: user.address };
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
    if (err) return res.status(500).json({ success: false, message: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.post('/api/register', async (req, res) => {
  const { first_name, last_name, company, address, suburb, city, postal_code, contact_number, email, password } = req.body;
  try {
    await pool.query(
      `INSERT INTO user_requests (first_name, last_name, company, address, suburb, city, postal_code, contact_number, email, password, status)
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

// Endpoint for unique filter values.
app.get('/api/inventory/filters', async (req, res) => {
  try {
    const [statusRows] = await pool.query('SELECT DISTINCT status FROM inventory');
    const [locationRows] = await pool.query('SELECT DISTINCT location FROM inventory');
    const [typeRows] = await pool.query('SELECT DISTINCT type FROM inventory');
    const [poRows] = await pool.query('SELECT DISTINCT po FROM inventory');
    res.json({
      status: statusRows.map(r => r.status),
      location: locationRows.map(r => r.location),
      type: typeRows.map(r => r.type),
      po: poRows.map(r => r.po)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Retrieve inventory items using search and filters.
app.get('/api/inventory', async (req, res) => {
  try {
    const user = req.session.user;
    let query = 'SELECT * FROM inventory WHERE 1=1';
    const params = [];

    // Search term
    if (req.query.search) {
      query += " AND (cs LIKE ? OR serial LIKE ? OR phone LIKE ?)";
      const term = `%${req.query.search}%`;
      params.push(term, term, term);
    }

    // Filters
    ['status', 'location', 'type', 'po'].forEach(filter => {
      if (req.query[filter]) {
        query += ` AND ${filter} = ?`;
        params.push(req.query[filter]);
      }
    });

    // Role-based filter
    if (user && user.role !== 'admin') {
      query += ' AND location = ?';
      params.push(`${user.name}`);
    }

    const [items] = await pool.query(query, params);
    res.json({ success: true, items });

    console.log("Logged in user:", user);
    console.log("Query being run:", query, params);

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search inventory by barcode (cs or serial)
app.get('/api/inventory/search', async (req, res) => {
  const { barcode } = req.query;
  try {
    const [rows] = await pool.query('SELECT * FROM inventory WHERE cs = ? OR serial = ?', [barcode, barcode]);
    if (rows.length > 0)
      res.json({ success: true, item: rows[0] });
    else
      res.json({ success: false, message: 'Item not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Comments endpoints.
app.get('/api/inventory/:id/comments', async (req, res) => {
  const itemId = req.params.id;
  const user = req.session.user;

  if (!user) return res.status(403).json({ success: false, message: 'Unauthorized' });

  try {
    let query = 'SELECT * FROM comments WHERE item_id = ? AND ';
    let params = [itemId];

    if (user.role === 'admin') {
      query += '(visibility = "admin" OR visibility = "user+admin")';
    } else {
      query += '(visibility = "user+admin" AND user_id = ?)';
      params.push(user.id);
    }

    const [comments] = await pool.query(query, params);
    res.json({ success: true, comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/inventory/:id/comments', async (req, res) => {
  const itemId = req.params.id;
  const { comment } = req.body;
  const user = req.session.user;

  if (!user) return res.status(403).json({ success: false, message: 'Unauthorized' });

  const visibility = user.role === 'admin' ? 'admin' : 'user+admin';

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

app.post('/api/inventory/receive', async (req, res) => {
  const user = req.session.user;
  const { csList } = req.body;

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized: Admins only' });
  }

  if (!csList || !Array.isArray(csList) || csList.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid request data' });
  }

  try {
    const updates = csList.map(cs =>
      pool.query(
        'UPDATE inventory SET location = ?, status = ? WHERE cs = ?',
        ['Warehouse', 'Storeroom', cs]  // 👈 Change status here
      )
    );

    await Promise.all(updates);
    res.json({ success: true, message: 'Items moved to Warehouse with Storeroom status.' });
  } catch (err) {
    console.error('Receive Error:', err);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

app.post('/api/inventory/upload', isAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const filePath = path.resolve(req.file.path);
  const items = [];
  const errors = [];
  const existingCs = new Set();

  try {
    const [existingRows] = await pool.query('SELECT cs FROM inventory');
    existingRows.forEach(row => existingCs.add(row.cs));

    fs.createReadStream(filePath)
      .pipe(csv.parse({ headers: true }))
      .on('error', error => {
        console.error('CSV Error:', error);
        res.status(500).json({ success: false, message: 'Failed to parse CSV' });
      })
      .on('data', row => {
        const { cs, serial, phone, type, status, location, po } = row;
        if (!cs || !serial || !phone || !type || !status || !location || !po) {
          errors.push(`Skipping row with missing fields: ${JSON.stringify(row)}`);
          return;
        }
        if (existingCs.has(cs)) {
          errors.push(`Duplicate CS skipped: ${cs}`);
          return;
        }
        items.push([cs, serial, phone, type, status, location, po]);
        existingCs.add(cs); // add to prevent duplicates within the file
      })
      .on('end', async () => {
        try {
          if (items.length > 0) {
            await pool.query(
              `INSERT INTO inventory (cs, serial, phone, type, status, location, po)
               VALUES ?`,
              [items]
            );
          }
          fs.unlinkSync(filePath);
          res.json({
            success: true,
            message: `${items.length} items added. ${errors.length ? errors.length + ' rows skipped.' : ''}`,
            skipped: errors,
          });
        } catch (err) {
          console.error('Insert Error:', err);
          res.status(500).json({ success: false, message: 'Database insert failed' });
        }
      });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// ---------------- Dispatch Endpoint ----------------

// Endpoint to process dispatch form submissions.
// For each item, update the inventory by setting location to the tech's name and status to "Dispatched".
app.post('/api/dispatch', async (req, res) => {
  const { techId, items } = req.body;
  try {
    const [techRows] = await pool.query('SELECT first_name, last_name FROM users WHERE id = ?', [techId]);
    if (techRows.length === 0)
      return res.status(404).json({ success: false, message: 'Tech not found' });
    const techName = `${techRows[0].first_name} ${techRows[0].last_name}`;

    for (const item of items) {
      await pool.query(
        'UPDATE inventory SET location = ?, status = ? WHERE cs = ?',
        [techName, 'Dispatched', item.cs]
      );
    }
    res.json({ success: true, message: 'Dispatch processed; items updated as Dispatched.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- Admin & User Management Endpoints ----------------
// Middleware to check for admin
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden. Admins only.' });
  }
}

// Get all approved users and pending registration requests.
app.get('/api/users', isAdmin, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users');
    const [requests] = await pool.query('SELECT * FROM user_requests WHERE status = "pending"');
    res.json({ success: true, users, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve registration request.
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

// Reject registration request.
app.post('/api/users/reject', isAdmin, async (req, res) => {
  const { request_id } = req.body;
  try {
    await pool.query('UPDATE user_requests SET status = "rejected" WHERE id = ?', [request_id]);
    res.json({ success: true, message: 'User registration rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Edit user details.
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

// Delete a user.
app.delete('/api/users/:id', isAdmin, async (req, res) => {
  const userId = req.params.id;
  try {
    await pool.query('DELETE FROM users WHERE id=?', [userId]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a list of users for the dispatch form.
app.get('/api/users/list', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, first_name, last_name, address, contact_number as contact, email, company FROM users');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- Start Server ----------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
