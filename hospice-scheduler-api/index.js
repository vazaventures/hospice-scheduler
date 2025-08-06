const express = require('express');
const cors = require('cors');
const snowflake = require('snowflake-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Configure your Snowflake connection using environment variables
const connection = snowflake.createConnection({
  account: process.env.SNOWFLAKE_ACCOUNT || 'ERHPAWA-WO05287',
  username: process.env.SNOWFLAKE_USER || 'COMFORTCARETEST',
  password: process.env.SNOWFLAKE_PASSWORD || '@RonakRonak1992',
  warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
  database: process.env.SNOWFLAKE_DATABASE || 'HOSPICE_SCHEDULER',
  schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
  role: process.env.SNOWFLAKE_ROLE || 'ACCOUNTADMIN'
});

// Connect to Snowflake
connection.connect((err, conn) => {
  if (err) {
    console.error('Unable to connect: ' + err.message);
  } else {
    console.log('Successfully connected to Snowflake.');
  }
});

// Helper to ensure connection is alive
function ensureConnection(callback) {
  if (connection.isUp && connection.isUp()) {
    callback();
  } else {
    connection.connect((err, conn) => {
      if (err) {
        console.error('Unable to reconnect: ' + err.message);
        callback(err);
      } else {
        console.log('Reconnected to Snowflake.');
        callback();
      }
    });
  }
}

// Test route
app.get('/', (req, res) => {
  res.send('Hospice Scheduler API is running!');
});

// Example: Get all patients
app.get('/api/patients', authenticateToken, (req, res) => {
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: 'SELECT * FROM patients',
      complete: function(err, stmt, rows) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json(rows);
        }
      }
    });
  });
});

// Secret for JWT - use environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_in_production';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  // Allow demo mode with special token
  if (token === 'DEMO_TOKEN') {
    req.user = { demo: true };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// REGISTER endpoint
app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  // Hash the password
  const password_hash = bcrypt.hashSync(password, 10);

  // Insert user into Snowflake
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
      binds: [Date.now().toString(), email, password_hash],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'User registered successfully' });
        }
      }
    });
  });
});

// LOGIN endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  // Get user from Snowflake
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: `SELECT * FROM users WHERE email = ?`,
      binds: [email],
      complete: function(err, stmt, rows) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else if (!rows || rows.length === 0) {
          res.status(401).json({ error: 'Invalid email or password' });
        } else {
          const user = rows[0];
          // Compare password
          if (bcrypt.compareSync(password, user.PASSWORD_HASH)) {
            // Create JWT
            const token = jwt.sign({ userId: user.ID, email: user.EMAIL }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token });
          } else {
            res.status(401).json({ error: 'Invalid email or password' });
          }
        }
      }
    });
  });
});

app.post('/api/patients', authenticateToken, (req, res) => {
  const { id, name, city, frequency, preferredRN, preferredLVN, status, dischargeDate } = req.body;
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: `INSERT INTO patients (id, name, city, frequency, preferredRN, preferredLVN, status, dischargeDate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      binds: [id, name, city, frequency, preferredRN, preferredLVN, status, dischargeDate],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Patient added successfully' });
        }
      }
    });
  });
});

app.put('/api/patients/:id', authenticateToken, (req, res) => {
  const { name, city, frequency, preferredRN, preferredLVN, status, dischargeDate } = req.body;
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: `UPDATE patients SET name=?, city=?, frequency=?, preferredRN=?, preferredLVN=?, status=?, dischargeDate=?
                WHERE id=?`,
      binds: [name, city, frequency, preferredRN, preferredLVN, status, dischargeDate, req.params.id],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Patient updated successfully' });
        }
      }
    });
  });
});

app.delete('/api/patients/:id', authenticateToken, (req, res) => {
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: `DELETE FROM patients WHERE id=?`,
      binds: [req.params.id],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Patient deleted successfully' });
        }
      }
    });
  });
});

app.get('/api/visits', authenticateToken, (req, res) => {
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: 'SELECT * FROM visits',
      complete: function(err, stmt, rows) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json(rows);
        }
      }
    });
  });
});

app.post('/api/visits', authenticateToken, (req, res) => {
  const { id, patientId, date, staff, discipline, type, tags, completed, notes } = req.body;
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: `
        INSERT INTO visits (id, patientId, date, staff, discipline, type, tags, completed, notes)
        SELECT ?, ?, ?, ?, ?, ?, PARSE_JSON(?), ?, ?
      `,
      binds: [id, patientId, date, staff, discipline, type, JSON.stringify(tags), completed, notes],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Visit added successfully' });
        }
      }
    });
  });
});

app.put('/api/visits/:id', authenticateToken, (req, res) => {
  const { patientId, date, staff, discipline, type, tags, completed, notes } = req.body;
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: `UPDATE visits SET patientId=?, date=?, staff=?, discipline=?, type=?, tags=PARSE_JSON(?), completed=?, notes=?
                WHERE id=?`,
      binds: [patientId, date, staff, discipline, type, JSON.stringify(tags), completed, notes, req.params.id],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Visit updated successfully' });
        }
      }
    });
  });
});

app.delete('/api/visits/:id', authenticateToken, (req, res) => {
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: `DELETE FROM visits WHERE id=?`,
      binds: [req.params.id],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Visit deleted successfully' });
        }
      }
    });
  });
});

// --- Staff Endpoints ---
// List all staff
app.get('/api/staff', authenticateToken, (req, res) => {
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: 'SELECT * FROM staff',
      complete: function(err, stmt, rows) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json(rows);
        }
      }
    });
  });
});

// Add new staff
app.post('/api/staff', authenticateToken, (req, res) => {
  const { id, name, role, active } = req.body;
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: 'INSERT INTO staff (id, name, role, active) VALUES (?, ?, ?, ?)',
      binds: [id, name, role, active !== undefined ? active : true],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Staff added successfully' });
        }
      }
    });
  });
});

// Edit staff
app.put('/api/staff/:id', authenticateToken, (req, res) => {
  const { name, role, active } = req.body;
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: 'UPDATE staff SET name=?, role=?, active=? WHERE id=?',
      binds: [name, role, active, req.params.id],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Staff updated successfully' });
        }
      }
    });
  });
});

// Delete staff
app.delete('/api/staff/:id', authenticateToken, (req, res) => {
  ensureConnection((err) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.execute({
      sqlText: 'DELETE FROM staff WHERE id=?',
      binds: [req.params.id],
      complete: function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Staff deleted successfully' });
        }
      }
    });
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server listening on port ${PORT}`);
});