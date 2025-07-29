# 🏥 Hospice Scheduler MVP

A comprehensive hospice care management system for scheduling visits, managing patients, and coordinating staff assignments.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation & Setup

1. **Clone and install dependencies:**
   ```bash
   cd hospice-scheduler
   npm install
   cd hospice-scheduler-api
   npm install
   ```

2. **Start the API server:**
   ```bash
   cd hospice-scheduler-api
   node index.js
   ```
   The API will run on `http://localhost:4000`

3. **Start the frontend (in a new terminal):**
   ```bash
   cd hospice-scheduler
   npm run dev
   ```
   The app will open at `http://localhost:5173`

## 🎯 MVP Features

### ✅ Core Functionality
- **Patient Management**: Add, edit, and manage patient information
- **Staff Management**: Manage RN, LVN, and NP assignments
- **Visit Scheduling**: Schedule and track patient visits
- **RN Dashboard**: Monitor RN visit requirements and completion
- **Weekly Schedule**: Visual weekly scheduling with drag & drop
- **Visit Check**: Quick visit assignment and status updates
- **Team Assignment**: Assign staff to patients and manage teams
- **Analytics**: Dashboard with key metrics and insights

### 🔐 Authentication
- **Demo Mode**: Click "Try Demo Mode" for instant access
- **Login/Register**: Full authentication system with JWT tokens
- **Data Persistence**: localStorage for demo, API for production

## 📱 How to Use

### 1. Getting Started
1. Open `http://localhost:5173` in your browser
2. Click **"Try Demo Mode"** for instant access
3. Or register/login with credentials

### 2. Main Navigation
- **✅ VisitCheck**: Quick visit assignment and status
- **👥 Team Assignment**: Assign staff to patients
- **📈 Analytics**: View key metrics and reports
- **👥 Patients**: Manage patient information
- **🩺 RN Dashboard**: RN-specific visit management
- **📅 Schedule**: Weekly scheduling with drag & drop
- **👥 Staff**: Manage staff members
- **📊 Data Editor**: Raw data management

### 3. Key Workflows

#### Managing Patients
1. Go to **👥 Patients** tab
2. Click **"Edit"** on any patient row
3. Update assignments, frequency, or other details
4. Click **"Save"** to persist changes

#### Scheduling Visits
1. Go to **✅ VisitCheck** tab
2. Assign staff to unassigned patients
3. Confirm visits to mark them complete
4. View scheduled visits in **📅 Schedule** tab

#### RN Visit Management
1. Go to **🩺 RN Dashboard** tab
2. View patients needing RN visits
3. Click **"Complete Visit"** when visits are done
4. Monitor recertification due dates

#### Weekly Scheduling
1. Go to **📅 Schedule** tab
2. Drag and drop visits between days/staff
3. Use **"+"** buttons to add new visits
4. All changes sync across all dashboards

## 🏗️ Architecture

### Frontend (React + Vite)
- **React 19**: Modern React with hooks
- **Vite**: Fast development server
- **CSS-in-JS**: Styled components for UI
- **Local Storage**: Demo data persistence

### Backend (Node.js + Express)
- **Express**: RESTful API server
- **JWT**: Authentication tokens
- **Snowflake**: Database (production)
- **CORS**: Cross-origin support

### Data Management
- **Centralized DataManager**: Single source of truth
- **Real-time Sync**: Publisher/subscriber pattern
- **CRUD Operations**: Full data management
- **Error Handling**: Graceful fallbacks

## 📊 Data Management

The application provides comprehensive data management:
- **Patient Management**: Add, edit, and track patient information
- **Staff Management**: Manage RN, LVN, and NP staff members
- **Visit Scheduling**: Create and track patient visits
- **Data Import/Export**: JSON-based data management

## 🔧 Development

### Project Structure
```
hospice-scheduler/
├── src/                    # React components
│   ├── App.jsx            # Main application
│   ├── dataManager.js     # Data management
│   ├── VisitCheck.jsx     # Visit assignment
│   ├── RnDashboard.jsx    # RN management
│   ├── WeeklySchedule.jsx # Weekly scheduling
│   └── ...                # Other components
├── data/                  # Data files (if any)
├── hospice-scheduler-api/ # Backend API
└── public/               # Static assets
```

### Key Components
- **VisitCheck**: Quick visit assignment interface
- **RnDashboard**: RN-specific visit management
- **WeeklySchedule**: Drag & drop weekly scheduling
- **MainDashboard**: Patient management
- **StaffManager**: Staff administration
- **DataEditor**: Data import/export and management

## 🚀 Deployment

### Development
```bash
npm run dev          # Start frontend dev server
cd hospice-scheduler-api && node index.js  # Start API server
```

### Production
```bash
npm run build        # Build frontend for production
# Deploy built files and API server
```

## 🐛 Troubleshooting

### Common Issues
1. **API not responding**: Check if API server is running on port 4000
2. **Data not loading**: Try demo mode or check API connection
3. **Port conflicts**: Change ports in vite.config.js or API server

### Demo Mode
- Uses localStorage for data persistence
- No backend required
- Perfect for testing and demos
- Data persists between sessions

## 📈 Next Steps

### Potential Enhancements
- **Mobile App**: Native mobile application
- **Notifications**: Email/SMS alerts
- **Advanced Analytics**: Predictive scheduling
- **EHR Integration**: Electronic health records
- **Offline Support**: Work without internet

### Performance Optimizations
- **Caching**: Implement data caching
- **Pagination**: Handle large datasets
- **Real-time Sync**: WebSocket updates
- **Progressive Web App**: PWA features

## 📞 Support

For issues or questions:
1. Check the browser console for errors
2. Verify both servers are running
3. Try demo mode for isolated testing
4. Review the CORE_FUNCTIONALITY_README.md for detailed implementation

---

**🎉 The Hospice Scheduler MVP is ready for use!** 

Start with demo mode to explore all features, then set up authentication for production use. 