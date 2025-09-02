# 🏔️ PeakLog

<div align="center">
  <img src="public/icon-512.svg" alt="PeakLog Icon" width="120" height="120">
  <br><br>
</div>

A comprehensive training management and performance tracking platform designed for sports teams and coaches. Built for endurance sports like canoe/kayak, rowing, swimming, and running, with advanced features for athlete management, training scheduling, performance testing, and progress tracking.

🌐 **Live Demo**: [https://peaklog-a10b4.web.app](https://peaklog-a10b4.web.app)

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite 7
- **UI Framework**: ShadCN UI + TailwindCSS v4
- **Backend**: Firebase (Auth + Firestore + Analytics)
- **Authentication**: Firebase Auth (Email/Password + Passwordless Magic Links)
- **Database**: Cloud Firestore
- **Routing**: React Router DOM v6
- **Form Handling**: React Hook Form
- **Icons**: Lucide React
- **Code Quality**: ESLint + Prettier
- **Deployment**: Netlify

## ✨ Features

### 🔐 Authentication & Security
- **🪄 Passwordless Magic Link Login** - Secure, password-free authentication via email links
- **🔑 Traditional Email/Password** - Classic login option available
- **👥 Multi-Level Role-Based Access Control** - Super Admin, Club Admin, and Athlete permissions
- **🛡️ Firebase Security Rules** - Comprehensive server-side data protection
- **🔒 Environment Variable Protection** - Secure API key management

### 📅 Training Scheduling & Management
- **📆 Interactive Training Calendar** - Monthly calendar view with attendance tracking
- **🏖️ Vacation & Cancellation Management** - Pre-schedule training cancellations with reasons
- **⏰ Weekly Schedule Management** - Set recurring training days and times
- **📱 Quick Attendance** - One-click attendance marking for coaches
- **📊 Training History** - Complete log of past training sessions and attendance

### 🏆 Performance Testing & Tracking
- **📏 Test Limits System** - Record athlete performance peaks for specific training days
- **📊 Performance Categories** - Manage custom categories (Bench Press, 1000m Time, etc.)
- **📈 Progress Charts** - Visual progress tracking with line graphs for each category
- **🎯 Goal Integration** - Automatic goal updates based on test performance
- **🏅 Personal Best Tracking** - Automatic PB updates from test results

### 👥 Athlete Management
- **👤 Member Management** - Add, remove, and manage club members
- **📋 Personal Records & Goals** - Track individual athlete performance and objectives
- **📱 Mobile-Optimized Views** - Responsive card layouts for mobile devices
- **👨‍👩‍👧‍👦 Family Accounts** - Multiple athletes per account support
- **📊 Performance Analytics** - Individual athlete progress tracking

### 💬 Communication & Messaging
- **📢 Club Announcements** - Coaches can post messages visible to all athletes
- **🏠 Dashboard Integration** - Messages displayed on athlete dashboard
- **📅 Training Notifications** - Cancelled training alerts with reasons
- **⏰ Today's Training Status** - Real-time training state (upcoming/in-progress/completed)

### 🎨 User Experience
- **🌟 Modern UI** - Beautiful, responsive design with ShadCN components
- **📱 Mobile-First** - Optimized for all device sizes and screen orientations
- **⚡ Fast Performance** - Vite-powered development and optimized builds
- **🔄 Real-time Updates** - Live data synchronization with Firestore
- **🎭 Professional Design** - Clean, intuitive interface for athletes and coaches
- **🌓 Dark/Light Theme Ready** - Extensible theming system

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Firebase project with Authentication and Firestore enabled
- Git

### 1. Clone and Install

```bash
git clone https://github.com/alexlibe95/PeakLog.git
cd PeakLog
npm install
```

### 2. Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. **Enable Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password" provider
   - Enable "Email link (passwordless sign-in)"
   - Add your domain to authorized domains (localhost, your-domain.com)
3. **Create Firestore Database**:
   - Go to Firestore Database → Create database
   - Start in test mode (we'll add security rules later)
4. Copy your Firebase config from Project Settings → General → Your apps

### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 4. Firestore Security Rules

Copy the contents of `firestore.rules` to your Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5180` to see the app!

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # ShadCN UI components (Button, Input, Card, etc.)
│   ├── features/       # Feature-specific components (Goals, Records, etc.)
│   ├── Navigation.jsx  # Global navigation with responsive burger menu
│   ├── PasswordlessLogin.jsx  # Magic link authentication
│   ├── ProtectedRoute.jsx     # Route protection wrapper
│   ├── TrainingCalendar.jsx   # Interactive monthly training calendar
│   ├── VacationManager.jsx    # Training cancellation management
│   ├── AdminMessageManager.jsx # Club announcement system
│   └── icons/          # Custom SVG icon components
├── pages/              # Route components
│   ├── Dashboard.jsx   # Main dashboard with role-based views
│   ├── Training.jsx    # Athlete training interface
│   ├── TrainingLogs.jsx # Training history and logging
│   ├── TrainingManagement.jsx # Admin training management
│   ├── AthleteManagement.jsx # Athlete performance management
│   ├── CategoryManagement.jsx # Performance category management
│   ├── Testing.jsx     # Performance testing interface
│   ├── MyProgress.jsx  # Athlete progress charts
│   ├── Login.jsx       # Authentication page
│   ├── Register.jsx    # User registration
│   ├── Settings.jsx    # User profile and settings
│   ├── AuthCallback.jsx # Email link verification handler
│   └── SuperAdminPage.jsx # Super admin dashboard
├── context/            # React context providers
│   └── AuthContext.jsx # Authentication and user state management
├── services/           # API and data services
│   ├── clubService.js          # Club and member management
│   ├── trainingService.js      # Training data operations
│   ├── athletePerformanceService.js # Performance tracking
│   ├── performanceCategoryService.js # Category management
│   └── testService.js          # Performance testing operations
├── lib/                # Configuration and utilities
│   ├── firebase.js     # Firebase initialization
│   └── utils.js        # Utility functions
├── hooks/              # Custom React hooks
└── styles/             # Global styles
    └── index.css       # TailwindCSS + custom styles
```

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server (localhost:5180)
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
npm run type-check   # TypeScript type checking
```

## 🎯 User Roles

### 👤 Athlete
- **📊 Dashboard Access** - Personal dashboard with training status and messages
- **📝 Training Logging** - Log training sessions with type, duration, and notes
- **🏆 Personal Records** - Track PRs and view performance history
- **🎯 Goal Management** - Set and track personal performance goals
- **📈 Progress Charts** - View performance trends with interactive charts
- **📅 Attendance Tracking** - View training attendance and schedule
- **💬 Message Center** - Receive coach announcements and updates

### 👨‍🏫 Club Admin (Coach)
- **👥 Member Management** - Add/remove athletes, manage club membership
- **📅 Training Calendar** - Interactive calendar with attendance management
- **🏖️ Vacation Planning** - Schedule training cancellations with reasons
- **⏰ Schedule Management** - Set weekly training schedules
- **📊 Performance Testing** - Record athlete test results and manage categories
- **📋 Athlete Oversight** - View all athlete data, records, and goals
- **📢 Communication** - Post messages and announcements for athletes
- **📈 Team Analytics** - Monitor team performance and attendance trends

### 👑 Super Admin
- **🏢 Multi-Club Management** - Access and manage multiple clubs
- **👤 User Administration** - Manage user roles and permissions across clubs
- **📊 System Analytics** - View system-wide statistics and usage data
- **⚙️ System Configuration** - Configure system settings and defaults
- **🔧 Administrative Tools** - Advanced system management features

## 🔐 Security

- Role-based access control
- Firestore security rules
- Environment variable protection
- Firebase Authentication

## 🎮 Authentication Demo

### Magic Link Login
1. Visit the login page
2. Click "**Sign in with Magic Link**" (recommended)
3. Enter your email address
4. Check your email and click the magic link
5. Automatically signed in - no password required!

### Traditional Login
- Standard email/password authentication also available
- Registration page with sport selection and user details

## 🔧 Development Guidelines

### Code Standards
1. **Code Style**: Follow existing patterns and ESLint/Prettier rules
2. **Components**: Use functional components with hooks
3. **Styling**: Use ShadCN UI components + TailwindCSS classes (no inline styles)
4. **Architecture**: Keep components small, reusable, and well-documented
5. **Security**: Follow Firebase security best practices
6. **Testing**: Test both authentication methods before commits

### Development Workflow
```bash
git checkout -b feature/your-feature
npm run lint:fix && npm run format
npm run build  # Test production build
git commit -m "feat: your feature description"
git push origin feature/your-feature
```

### Development Best Practices
- **🔧 Pre-commit Hooks** - Run lint and format before committing
- **📱 Mobile Testing** - Test all features on mobile devices
- **🎯 Feature Flags** - Use feature flags for gradual rollouts
- **📊 Performance Monitoring** - Monitor bundle size and loading times
- **🧪 Error Handling** - Implement comprehensive error boundaries
- **♿ Accessibility** - Ensure WCAG compliance for all components
- **🔒 Security First** - Follow Firebase security best practices

## 📋 Roadmap

### 🎯 Core Features (Implemented)
- [x] **Multi-Level Authentication** - Magic link + traditional login with Super Admin/Admin/Athlete roles
- [x] **Interactive Training Calendar** - Monthly calendar with attendance tracking and vacation management
- [x] **Performance Testing System** - Test limits recording with automatic PB/goal updates
- [x] **Progress Visualization** - Interactive charts with Recharts library
- [x] **Communication System** - Club announcements and training notifications
- [x] **Mobile-Responsive Design** - Optimized for all device sizes
- [x] **Real-time Data Sync** - Live updates with Firestore
- [x] **Comprehensive Athlete Management** - Records, goals, and performance tracking
- [x] **Category Management** - Custom performance categories with unit handling
- [x] **Training Scheduling** - Weekly schedules with cancellation support

### 🚀 Future Enhancements
- [ ] **Advanced Analytics Dashboard** - Team performance trends and comparative analysis
- [ ] **Data Export/Import** - CSV/PDF export and bulk data operations
- [ ] **Mobile App** - React Native companion app for iOS/Android
- [ ] **Training Plan Templates** - Pre-built workout programs and progression plans
- [ ] **Team Communication** - Direct messaging between coaches and athletes
- [ ] **Offline Support** - PWA capabilities for offline training logging
- [ ] **Integration APIs** - Connect with fitness devices and external systems
- [ ] **Advanced Reporting** - Custom reports and performance insights
- [ ] **Team Challenges** - Create and track team-wide performance challenges
- [ ] **Nutrition Tracking** - Dietary logging and nutrition goal setting

## 🛠️ Technical Highlights

### Modern React Patterns
- **Context API** for global state management with multi-role authentication
- **Custom Hooks** for reusable logic across components
- **Component Composition** with ShadCN UI component library
- **TypeScript-Ready** architecture with type-safe patterns
- **Responsive Design** with mobile-first approach and TailwindCSS

### Advanced UI/UX Features
- **Interactive Calendar** - Custom calendar component with date manipulation
- **Data Visualization** - Recharts integration for performance tracking
- **Real-time Messaging** - Live communication between coaches and athletes
- **Role-Based UI** - Dynamic interfaces based on user permissions
- **Progressive Web App Ready** - Service worker and offline capabilities

### Firebase Integration
- **Firebase v9+ SDK** - Latest modular Firebase implementation
- **Real-time Data** - Live updates with Firestore subscriptions
- **Advanced Security Rules** - Multi-level access control for clubs and users
- **Cloud Storage** - Profile picture uploads with automatic cleanup
- **Batch Operations** - Efficient data operations with Firestore batches

### Performance Optimizations
- **Vite Build Tool** - Lightning-fast development and optimized production builds
- **Code Splitting** - Automatic chunking for faster loading times
- **Tree Shaking** - Minimal bundle size with unused code elimination
- **Optimized Builds** - Fast loading with Vite build optimization
- **Image Optimization** - Efficient image handling and lazy loading

### Developer Experience
- **Hot Module Replacement** - Instant development feedback
- **ESLint + Prettier** - Automated code quality and formatting
- **Version Control** - Git-based development workflow
- **Environment Management** - Secure credential handling with Vite
- **Comprehensive Error Handling** - Robust error boundaries and user feedback

## 🏗️ Architecture Overview

### Key Components
- **🔄 AuthContext** - Centralized authentication state with role management
- **📅 TrainingCalendar** - Interactive calendar with attendance and scheduling
- **📊 MyProgress** - Athlete progress visualization with Recharts
- **🧪 Testing System** - Performance testing with automatic PB updates
- **💬 MessageManager** - Real-time communication system
- **📱 Responsive Navigation** - Mobile-first navigation with role-based menus

### Data Flow Patterns
- **Real-time Subscriptions** - Firestore listeners for live data updates
- **Optimistic Updates** - Immediate UI feedback with server sync
- **Batch Operations** - Efficient bulk data operations
- **Error Boundaries** - Graceful error handling and user feedback
- **Loading States** - Comprehensive loading indicators and skeleton screens

### Security Architecture
- **Role-Based Access Control** - Multi-level permissions (Super Admin → Admin → Athlete)
- **Firestore Security Rules** - Server-side data validation and access control
- **Input Validation** - Client and server-side validation
- **Secure File Uploads** - Safe profile picture handling with cleanup
- **Environment Security** - Protected API keys and configuration

## 📄 License

This is a private portfolio project. All rights reserved.

---

**🏔️ Built with ❤️ for the sports community**

**💡 Showcasing modern web development practices with React, Firebase, and comprehensive training management features**